#!/usr/bin/env python3
"""
Performance baseline benchmark script.

Measures latency for critical POS backend operations:
- Barcode lookup
- SKU lookup
- Inventory valuation
- Stock movement creation
- Movement history query

Usage:
    python scripts/benchmark.py --url http://localhost:8000 \\
        --email <admin-email> --password <admin-password> \\
        --tenant-id <uuid> --branch-id <uuid> --product-id <uuid>

    python scripts/benchmark.py --url http://localhost:8000 \\
        --email <admin-email> --password <admin-password> \\
        --tenant-id <uuid> --branch-id <uuid> --product-id <uuid> \\
        --iterations 100 --concurrency 10

Output: JSON summary of p50/p95/p99 latencies per operation.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import time
import uuid
from typing import Any

import httpx


async def _login(client: httpx.AsyncClient, url: str, email: str, password: str) -> str:
    resp = await client.post(
        f"{url}/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def _percentiles(times: list[float]) -> dict[str, float]:
    s = sorted(times)
    n = len(s)
    return {
        "min": round(s[0], 2),
        "p50": round(statistics.median(s), 2),
        "p90": round(s[int(n * 0.90)], 2),
        "p95": round(s[int(n * 0.95)], 2),
        "p99": round(s[min(int(n * 0.99), n - 1)], 2),
        "max": round(s[-1], 2),
        "mean": round(statistics.mean(s), 2),
        "count": n,
    }


async def bench_operation(
    client: httpx.AsyncClient,
    name: str,
    coro_factory,
    iterations: int,
    concurrency: int,
) -> dict[str, Any]:
    """Run `iterations` requests with up to `concurrency` in flight at once."""
    times: list[float] = []
    errors: int = 0

    semaphore = asyncio.Semaphore(concurrency)

    async def run_one() -> None:
        async with semaphore:
            t0 = time.perf_counter()
            try:
                await coro_factory()
            except Exception:
                nonlocal errors
                errors += 1
            finally:
                times.append((time.perf_counter() - t0) * 1000)

    await asyncio.gather(*[run_one() for _ in range(iterations)])

    result = _percentiles(times)
    result["errors"] = errors
    result["error_rate_pct"] = round(errors / iterations * 100, 1)
    print(f"  {name}: p50={result['p50']}ms p95={result['p95']}ms p99={result['p99']}ms errors={errors}")
    return result


async def run_benchmarks(
    *,
    url: str,
    email: str,
    password: str,
    tenant_id: str,
    branch_id: str,
    product_id: str,
    barcode: str | None,
    sku: str | None,
    iterations: int,
    concurrency: int,
) -> dict[str, Any]:
    results: dict[str, Any] = {}

    async with httpx.AsyncClient(timeout=30) as client:
        token = await _login(client, url, email, password)
        headers = {"Authorization": f"Bearer {token}"}

        print(f"\n{'=' * 60}")
        print(f"POS Backend Performance Benchmark")
        print(f"URL:         {url}")
        print(f"Iterations:  {iterations}  (concurrency: {concurrency})")
        print(f"{'=' * 60}\n")

        # Inventory position fetch
        print("Inventory operations:")

        async def fetch_inventory():
            await client.get(
                f"{url}/api/v1/inventory/branch/{branch_id}/product/{product_id}",
                headers=headers,
            )

        results["inventory_position_fetch"] = await bench_operation(
            client, "  inventory_position_fetch", fetch_inventory, iterations, concurrency
        )

        # Inventory valuation
        async def fetch_valuation():
            await client.get(
                f"{url}/api/v1/inventory/valuation/{branch_id}",
                headers=headers,
            )

        results["inventory_valuation"] = await bench_operation(
            client, "  inventory_valuation", fetch_valuation, iterations, concurrency
        )

        # Movement history
        async def fetch_movements():
            await client.get(
                f"{url}/api/v1/inventory/movements?branch_id={branch_id}&page_size=20",
                headers=headers,
            )

        results["movement_history_page1"] = await bench_operation(
            client, "  movement_history_page1", fetch_movements, iterations, concurrency
        )

        # Barcode lookup
        if barcode:
            print("\nProduct lookups:")

            async def barcode_lookup():
                await client.get(
                    f"{url}/api/v1/products/lookup/barcode/{barcode}",
                    headers=headers,
                )

            results["barcode_lookup"] = await bench_operation(
                client, "  barcode_lookup", barcode_lookup, iterations, concurrency
            )

        # SKU lookup
        if sku:
            async def sku_lookup():
                await client.get(
                    f"{url}/api/v1/products/lookup/sku/{sku}",
                    headers=headers,
                )

            results["sku_lookup"] = await bench_operation(
                client, "  sku_lookup", sku_lookup, iterations, concurrency
            )

        # Product list
        print("\nProduct/Category lists:")

        async def product_list():
            params = f"?tenant_id={tenant_id}" if not tenant_id else ""
            await client.get(
                f"{url}/api/v1/products/{params}",
                headers=headers,
            )

        results["product_list"] = await bench_operation(
            client, "  product_list", product_list, iterations, concurrency
        )

        # Health check
        print("\nHealth:")

        async def health():
            await client.get(f"{url}/health/ready")

        results["health_ready"] = await bench_operation(
            client, "  health_ready", health, iterations // 5, 1
        )

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="POS Backend Performance Benchmark")
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--tenant-id", required=True, dest="tenant_id")
    parser.add_argument("--branch-id", required=True, dest="branch_id")
    parser.add_argument("--product-id", required=True, dest="product_id")
    parser.add_argument("--barcode", default=None)
    parser.add_argument("--sku", default=None)
    parser.add_argument("--iterations", type=int, default=50)
    parser.add_argument("--concurrency", type=int, default=5)
    parser.add_argument("--output", default=None, help="Write JSON results to file")
    args = parser.parse_args()

    results = asyncio.run(
        run_benchmarks(
            url=args.url,
            email=args.email,
            password=args.password,
            tenant_id=args.tenant_id,
            branch_id=args.branch_id,
            product_id=args.product_id,
            barcode=args.barcode,
            sku=args.sku,
            iterations=args.iterations,
            concurrency=args.concurrency,
        )
    )

    print(f"\n{'=' * 60}")
    print("Summary (all times in milliseconds):")
    for op_name, stats in results.items():
        print(
            f"  {op_name:<35} "
            f"p50={stats['p50']:>7.1f}ms  "
            f"p99={stats['p99']:>7.1f}ms  "
            f"errors={stats['errors']}"
        )

    if args.output:
        with open(args.output, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\nResults written to {args.output}")


if __name__ == "__main__":
    main()
