// 저장 위치: /src/pages/CreateSitePage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, Star, Flame } from 'lucide-react'
import { PRODUCT_CATALOG } from '@/types'
import { getActiveProducts } from '@/lib/db'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'

const CATEGORIES = [
  '전체',
  '워드프레스 호스팅',
  '웹사이트 빌더',
  '쇼핑몰 / 커머스',
  '비즈니스 도구',
  '콘텐츠 & 미디어',
  '개발자 도구',
]

export function CreateSitePage() {
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState('전체')
  const [search, setSearch] = useState('')
  const [activeProductIds, setActiveProductIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActiveProducts()
  }, [])

  const loadActiveProducts = async () => {
    try {
      const products = await getActiveProducts()
      setActiveProductIds(new Set(products.map((p: { id: string }) => p.id)))
    } catch {
      // Supabase 연결 전 fallback: 모든 상품 활성화
      setActiveProductIds(new Set(PRODUCT_CATALOG.map((p) => p.id)))
    } finally {
      setLoading(false)
    }
  }

  const visibleProducts = PRODUCT_CATALOG.filter((product) => {
    // 비활성화 상품 숨김
    if (!activeProductIds.has(product.id)) return false
    // 카테고리 필터
    if (activeCategory !== '전체' && product.category !== activeCategory) return false
    // 검색 필터
    if (search && !product.name.includes(search) && !product.description.includes(search)) return false
    return true
  })

  const handleSelectProduct = (productId: string) => {
    navigate(`/create/${productId}`)
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">사이트 만들기</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          원하는 사이트 유형을 선택하면 자동으로 배포해드립니다
        </p>
      </div>

      {/* 검색 */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="사이트 유형 검색..."
          className="input-field pl-11 py-3"
        />
      </div>

      {/* 카테고리 탭 */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              activeCategory === cat
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 상품 그리드 */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg mb-2">검색 결과가 없습니다</p>
          <p className="text-sm">다른 키워드로 검색해보세요</p>
        </div>
      ) : (
        <>
          {/* 카테고리별 섹션 */}
          {activeCategory === '전체' ? (
            CATEGORIES.filter((c) => c !== '전체').map((category) => {
              const categoryProducts = visibleProducts.filter((p) => p.category === category)
              if (categoryProducts.length === 0) return null
              return (
                <div key={category} className="mb-10">
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-4">
                    {category}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {categoryProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onSelect={() => handleSelectProduct(product.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelect={() => handleSelectProduct(product.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ProductCard({
  product,
  onSelect,
}: {
  product: typeof PRODUCT_CATALOG[0]
  onSelect: () => void
}) {
  const isRecommended = product.tags.includes('추천')
  const isPopular = product.tags.includes('인기')

  return (
    <div
      className={cn(
        'card p-5 hover:shadow-card-hover transition-all duration-200 cursor-pointer group relative',
        isRecommended && 'ring-2 ring-primary/30 dark:ring-primary/50'
      )}
      onClick={onSelect}
    >
      {isRecommended && (
        <div className="absolute -top-2 left-4">
          <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            ⭐ 추천
          </span>
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className="text-2xl w-10 flex-shrink-0">{product.icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight mb-1">
            {product.name}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {product.description}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {product.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                tag === '인기' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' :
                tag === '추천' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' :
                'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              )}
            >
              {tag === '인기' && <Flame className="w-2.5 h-2.5" />}
              {tag === '추천' && <Star className="w-2.5 h-2.5" />}
              {tag}
            </span>
          ))}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onSelect() }}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-600 group-hover:gap-2 transition-all"
        >
          시작하기
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
