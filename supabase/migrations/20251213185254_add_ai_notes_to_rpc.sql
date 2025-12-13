CREATE OR REPLACE FUNCTION public.get_user_sentences_with_progress(p_user_id uuid)
 RETURNS TABLE(id bigint, spanish_text text, chinese_translation text, tags text[], is_mastered boolean, is_studied boolean, is_public boolean, ai_notes jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    public_user_id UUID;
BEGIN
    SELECT u.id INTO public_user_id FROM auth.users u WHERE u.email = 'chenlongfei@outlook.com';
    RETURN QUERY
    SELECT
        s.id,
        s.spanish_text,
        s.chinese_translation,
        s.tags,
        COALESCE(up.is_mastered, false) as is_mastered,
        (up.id IS NOT NULL) as is_studied,
        (s.user_id = public_user_id) as is_public,
        s.ai_notes
    FROM
        sentences s
    LEFT JOIN
        user_progress up ON s.id = up.sentence_id AND up.user_id = p_user_id
    WHERE
        s.user_id = public_user_id OR s.user_id = p_user_id;
END;
$function$
;
