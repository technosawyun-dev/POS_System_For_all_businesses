# Sawyun Print Agent

Build: cargo build --release
Run: target\release\sawyun-print-agent.exe

The agent listens only on 127.0.0.1:17891.
The default allowed web origin is https://pos.sawyuntech.com.
To allow any additional origin, set SAWYUN_PRINT_ORIGINS to the exact web origin.
