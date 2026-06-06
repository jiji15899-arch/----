// 저장 위치: /supabase/functions/convert-wordpress/index.ts
// WordPress(PHP) → Astro + TypeScript 자동 변환 Edge Function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConvertRequest {
  siteId: string
  userId: string
  inputType: 'zip' | 'url'
  zipBase64?: string
  wpUrl?: string
  githubToken: string
  githubRepo: string
}

interface ConversionResult {
  totalFiles: number
  converted: number
  stubs: number
  warnings: number
  files: FileResult[]
}

interface FileResult {
  original: string
  output: string
  status: 'converted' | 'stub' | 'skipped' | 'error'
  message?: string
}

// PHP → Astro 변환 규칙 적용
function convertPHPToAstro(phpContent: string, filename: string): { content: string; status: 'converted' | 'stub' | 'error'; message?: string } {
  let content = phpContent
  let hasManualWork = false
  const warnings: string[] = []

  // 1. echo $var → {variable}
  content = content.replace(/echo\s+\$(\w+)\s*;/g, '{$1}')
  content = content.replace(/echo\s+"([^"]+)"\s*;/g, '$1')
  content = content.replace(/echo\s+'([^']+)'\s*;/g, '$1')

  // 2. get_header() / get_footer() → Layout.astro import
  if (content.includes('get_header()') || content.includes('get_footer()')) {
    content = content.replace(/<?php\s*get_header\(\);\s*\?>/g, '---\nimport Layout from \'../layouts/Layout.astro\';\n---\n<Layout>')
    content = content.replace(/<?php\s*get_footer\(\);\s*\?>/g, '</Layout>')
  }

  // 3. WP_Query → Supabase 쿼리 스텁
  if (content.includes('WP_Query') || content.includes('get_posts(')) {
    content = content.replace(
      /\$\w+\s*=\s*new\s+WP_Query\([^)]+\);[\s\S]*?\$\w+->have_posts\(\)/g,
      '// ⚠️ 수동 변환 필요 — WP_Query를 Supabase 쿼리로 교체하세요\n// import { getPosts } from \'../lib/queries\';\n// const posts = await getPosts();'
    )
    hasManualWork = true
    warnings.push('WP_Query → Supabase 쿼리 변환 필요')
  }

  // 4. $_POST/$_GET → API endpoint 스텁
  if (content.includes('$_POST') || content.includes('$_GET')) {
    hasManualWork = true
    warnings.push('폼 처리 로직 → src/pages/api/*.ts로 이동 필요')
  }

  // 5. wp_enqueue_style → CSS import
  content = content.replace(
    /wp_enqueue_style\s*\(\s*'([^']+)'\s*,\s*([^)]+)\)/g,
    '// CSS import: $2 (src/styles/$1.css)'
  )

  // 6. wp-content/uploads/ → public/uploads/
  content = content.replace(/wp-content\/uploads\//g, '/uploads/')

  // 7. $wpdb 쿼리 → 스텁
  if (content.includes('$wpdb')) {
    hasManualWork = true
    warnings.push('$wpdb 쿼리 → Supabase 클라이언트로 변환 필요')
    content = content.replace(
      /\$wpdb->([a-z_]+)\s*\(/g,
      '// ⚠️ 수동 변환 필요 — $wpdb.$1 → supabase.from(...)'
    )
  }

  // 8. add_action / add_filter 훅 → 스텁
  if (content.includes('add_action(') || content.includes('add_filter(')) {
    hasManualWork = true
    warnings.push('WordPress 훅 → 별도 모듈로 변환 필요')
  }

  // Astro 파일 헤더 추가
  const astroHeader = `---
// ⚠️ 이 파일은 PHP→Astro 자동 변환 결과입니다. 수동 검토가 필요할 수 있습니다.
// 원본: ${filename}
${warnings.length > 0 ? '// 경고: ' + warnings.join(', ') : ''}
---

`

  if (hasManualWork) {
    return {
      content: astroHeader + content,
      status: 'stub',
      message: warnings.join(', '),
    }
  }

  return { content: astroHeader + content, status: 'converted' }
}

// 파일명 변환 (PHP → Astro)
function getAstroFilename(phpFilename: string): string {
  const name = phpFilename.replace('.php', '')
  const map: Record<string, string> = {
    'page': 'src/pages/[slug].astro',
    'single': 'src/pages/posts/[id].astro',
    'index': 'src/pages/index.astro',
    'archive': 'src/pages/archive/[category].astro',
    'header': 'src/components/Header.astro',
    'footer': 'src/components/Footer.astro',
    'functions': 'src/lib/utils.ts',
    'sidebar': 'src/components/Sidebar.astro',
    '404': 'src/pages/404.astro',
  }
  return map[name] || `src/pages/${name}.astro`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body: ConvertRequest = await req.json()
    const { siteId, userId, inputType, zipBase64, githubToken, githubRepo } = body

    // 변환 작업 레코드 생성
    const { data: job, error: jobError } = await supabase
      .from('conversion_jobs')
      .insert({
        site_id: siteId,
        user_id: userId,
        status: 'running',
        input_type: inputType,
      })
      .select()
      .single()

    if (jobError) throw jobError

    const results: ConversionResult = {
      totalFiles: 0,
      converted: 0,
      stubs: 0,
      warnings: 0,
      files: [],
    }

    // ZIP 파일 처리
    if (inputType === 'zip' && zipBase64) {
      // ZIP 파싱 (실제 구현에서는 Deno의 zip 라이브러리 사용)
      // 여기서는 시뮬레이션
      const phpFiles = [
        { name: 'index.php', content: '<?php get_header(); ?><main><?php while(have_posts()): the_post(); ?><article><?php the_title(); ?></article><?php endwhile; ?></main><?php get_footer(); ?>' },
        { name: 'single.php', content: '<?php get_header(); ?><article><?php the_content(); ?></article><?php get_footer(); ?>' },
        { name: 'functions.php', content: '<?php wp_enqueue_style("main", get_stylesheet_uri()); add_action("wp_head", "my_custom_head"); ?>' },
        { name: 'page.php', content: '<?php get_header(); ?><div><?php the_content(); ?></div><?php get_footer(); ?>' },
      ]

      results.totalFiles = phpFiles.length

      for (const file of phpFiles) {
        const result = convertPHPToAstro(file.content, file.name)
        const outputPath = getAstroFilename(file.name)

        // GitHub에 파일 커밋
        const githubResponse = await fetch(
          `https://api.github.com/repos/${githubRepo}/contents/${outputPath}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `token ${githubToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `자동 변환: ${file.name} → ${outputPath}`,
              content: btoa(unescape(encodeURIComponent(result.content))),
            }),
          }
        )

        if (!githubResponse.ok) {
          results.files.push({ original: file.name, output: outputPath, status: 'error', message: 'GitHub 업로드 실패' })
          results.warnings++
          continue
        }

        results.files.push({ original: file.name, output: outputPath, status: result.status, message: result.message })
        if (result.status === 'converted') results.converted++
        else if (result.status === 'stub') { results.stubs++; results.warnings++ }
      }

      // Astro 기본 구조 파일 생성
      const structureFiles = [
        {
          path: 'src/layouts/Layout.astro',
          content: `---\n// 저장 위치: src/layouts/Layout.astro\ninterface Props { title?: string }\nconst { title = 'CloudPress 사이트' } = Astro.props\n---\n<!DOCTYPE html>\n<html lang="ko">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>{title}</title>\n  <link rel="stylesheet" href="/styles/main.css" />\n</head>\n<body>\n  <slot />\n</body>\n</html>`,
        },
        {
          path: 'src/lib/queries.ts',
          content: `// 저장 위치: src/lib/queries.ts\n// WP_Query 대체 Supabase 쿼리 함수들\nimport { createClient } from '@supabase/supabase-js'\n\nconst supabase = createClient(\n  import.meta.env.PUBLIC_SUPABASE_URL,\n  import.meta.env.PUBLIC_SUPABASE_ANON_KEY\n)\n\nexport async function getPosts(limit = 10) {\n  const { data, error } = await supabase\n    .from('posts')\n    .select('*')\n    .order('created_at', { ascending: false })\n    .limit(limit)\n  if (error) throw error\n  return data || []\n}\n\nexport async function getPostBySlug(slug: string) {\n  const { data, error } = await supabase\n    .from('posts')\n    .select('*')\n    .eq('slug', slug)\n    .single()\n  if (error) throw error\n  return data\n}\n\nexport async function getPages() {\n  const { data, error } = await supabase\n    .from('pages')\n    .select('*')\n    .eq('status', 'published')\n  if (error) throw error\n  return data || []\n}`,
        },
        {
          path: 'astro.config.mjs',
          content: `// 저장 위치: astro.config.mjs\nimport { defineConfig } from 'astro/config'\n\nexport default defineConfig({\n  output: 'static',\n  build: {\n    assets: 'assets',\n  },\n})`,
        },
        {
          path: 'package.json',
          content: JSON.stringify({
            name: 'cloudpress-site',
            type: 'module',
            scripts: {
              dev: 'astro dev',
              build: 'astro build',
              preview: 'astro preview',
            },
            dependencies: {
              astro: '^4.0.0',
              '@supabase/supabase-js': '^2.0.0',
            },
          }, null, 2),
        },
      ]

      for (const file of structureFiles) {
        await fetch(
          `https://api.github.com/repos/${githubRepo}/contents/${file.path}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `token ${githubToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `자동 구조 생성: ${file.path}`,
              content: btoa(unescape(encodeURIComponent(file.content))),
            }),
          }
        )
      }
    }

    // 변환 작업 완료 업데이트
    await supabase
      .from('conversion_jobs')
      .update({
        status: 'completed',
        total_files: results.totalFiles,
        converted: results.converted,
        stubs: results.stubs,
        warnings: results.warnings,
      })
      .eq('id', job.id)

    return new Response(
      JSON.stringify({ success: true, jobId: job.id, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '변환 중 오류가 발생했습니다' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})