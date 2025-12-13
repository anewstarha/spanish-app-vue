-- 允许所有认证用户查看管理员(公共)发布的单词
CREATE POLICY "Users can see admin words"
ON "public"."high_frequency_words"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    user_id = public.get_admin_id()
);
