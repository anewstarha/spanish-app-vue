-- 允许所有认证用户查看管理员(公共)发布的句子
CREATE POLICY "Users can see admin sentences"
ON "public"."sentences"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    user_id IN (
        SELECT id FROM auth.users WHERE email = 'chenlongfei@outlook.com'
    )
);
