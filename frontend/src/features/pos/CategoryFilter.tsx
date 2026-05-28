import { cn } from '@/lib/utils'

interface CategoryItem {
  id: string
  name: string
}

interface CategoryFilterProps {
  categories: CategoryItem[]
  activeCategory: string
  onSelect: (id: string) => void
}

export default function CategoryFilter({ categories, activeCategory, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none flex-shrink-0">
      {categories.map(cat => {
        const isActive = activeCategory === cat.id
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 whitespace-nowrap',
              isActive
                ? 'bg-amber-500 border-amber-400 text-black'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700',
            )}
          >
            {cat.name}
          </button>
        )
      })}
    </div>
  )
}
