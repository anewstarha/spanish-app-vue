// src/supabase.js

import { createClient } from '@supabase/supabase-js'

// Supabase 连接信息 (来自你之前的项目)
const SUPABASE_URL = 'https://rvarfascuwvponxwdeoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2YXJmYXNjdXd2cG9ueHdkZW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNDE5MDcsImV4cCI6MjA3MTgxNzkwN30.KdBVtNYdOw9n8351FWlAgAPCv0WmSnr9vOGgtHCRSnc';

// 创建并导出 Supabase 客户端实例，供整个应用使用
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
