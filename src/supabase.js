// src/supabase.js

import { createClient } from '@supabase/supabase-js'

// 从 Vite 的环境变量中读取 URL 和 Key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 导出一个变量并在运行时赋值，避免在条件分支中使用 export 导致构建失败
export let supabase

if (!supabaseUrl || !supabaseAnonKey) {
	console.error('[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing.\n' +
		'Build your app with these environment variables set so the Supabase client can be initialized.\n' +
		"Example: create a .env.production with:\nVITE_SUPABASE_URL=your_url\nVITE_SUPABASE_ANON_KEY=your_key\nand run: npm run build")

	// 提供一个 minimal auth shim：保证 main.js 里调用的 auth.getSession 和 onAuthStateChange 不会抛错
	const noopAuth = {
		async getSession() {
			return { data: { session: null } }
		},
				onAuthStateChange() {
					return { data: null }
				}
	}

	const proxyHandler = {
		get(target, prop) {
			if (prop === 'auth') return noopAuth
			return () => { throw new Error('[supabase] Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and rebuild the app.') }
		}
	}

	supabase = new Proxy({}, proxyHandler)
} else {
	// 正常路径：使用 createClient 创建 supabase 实例
	supabase = createClient(supabaseUrl, supabaseAnonKey)
}
