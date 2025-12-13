-- 1. 创建一个特权函数来获取管理员ID（绕过权限限制）
CREATE OR REPLACE FUNCTION public.get_admin_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM auth.users WHERE email = 'chenlongfei@outlook.com' LIMIT 1;
$$;

-- 2. 删除旧的报错策略
DROP POLICY IF EXISTS "Users can see admin sentences" ON "public"."sentences";

-- 3. 创建新的安全策略，调用函数而不是直接查表
CREATE POLICY "Users can see admin sentences"
ON "public"."sentences"
FOR SELECT
TO authenticated
USING (
    user_id = public.get_admin_id()
);
