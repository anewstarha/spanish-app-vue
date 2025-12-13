-- 1. 创建(或重建)特权函数 get_admin_id
CREATE OR REPLACE FUNCTION public.get_admin_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE email = 'chenlongfei@outlook.com' LIMIT 1;
$$;

-- 确保函数可执行
GRANT EXECUTE ON FUNCTION public.get_admin_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_id() TO service_role;

-- 2. 修复 sentences 表的权限
DROP POLICY IF EXISTS "Users can see admin sentences" ON "public"."sentences";

CREATE POLICY "Users can see admin sentences"
ON "public"."sentences"
FOR SELECT
TO authenticated
USING (
    user_id = public.get_admin_id()
);

-- 3. 修复 high_frequency_words 表的权限
DROP POLICY IF EXISTS "Users can see admin words" ON "public"."high_frequency_words";

CREATE POLICY "Users can see admin words"
ON "public"."high_frequency_words"
FOR SELECT
TO authenticated
USING (
    user_id = public.get_admin_id()
);
