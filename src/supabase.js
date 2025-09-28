// src/supabase.js

import { createClient } from '@supabase/supabase-js'

// 从 Vite 的环境变量中读取 URL 和 Key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 使用读取到的变量来创建客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
