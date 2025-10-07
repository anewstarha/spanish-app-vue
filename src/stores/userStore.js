import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/supabase'
import router from '@/router'

export const useUserStore = defineStore('user', () => {
    const user = ref(undefined)
    const profile = ref(null)
    const isInitialized = ref(false) // 新增：标记认证状态是否已初始化

    const isLoggedIn = computed(() => user.value !== null && user.value !== undefined)

    async function setUser(newUser, markAsInitialized = true) {
        user.value = newUser
        if (markAsInitialized) {
            isInitialized.value = true // 标记认证状态已初始化
        }
        if (newUser) {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', newUser.id)
                .single()
            if (error) console.error("获取用户档案失败:", error)
            else profile.value = data
        } else {
            profile.value = null
        }
    }

    // --- NEW ---
    // 通用的用户配置更新函数
    async function updateUserProfile(dataToUpdate) {
        if (!profile.value) return;

        const { data, error } = await supabase
            .from('profiles')
            .update(dataToUpdate)
            .eq('id', profile.value.id)
            .select()
            .single();

        if (error) {
            console.error("更新用户配置失败:", error);
        } else {
            // 更新本地的 profile 状态以保持同步
            profile.value = data;
        }
    }

    async function signUp(email, password, nickname) {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { nickname: nickname } }
        })
        if (error) throw error
        router.push('/')
    }

    async function signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        })
        if (error) throw error
        router.push('/')
    }

    async function signOut() {
        await supabase.auth.signOut()
        user.value = null
        profile.value = null
        router.push('/login')
    }

    // --- MODIFIED ---
    // 之前叫 updateSessionProgress，现在改名为 updateUserProfile 并导出
    return { user, profile, isLoggedIn, isInitialized, setUser, updateUserProfile, signUp, signIn, signOut }
})
