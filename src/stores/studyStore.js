// src/stores/userStore.js

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue' // 1. 导入 watch
import { supabase } from '@/supabase'
import router from '@/router'

export const useUserStore = defineStore('user', () => {
    const user = ref(undefined)
    const profile = ref(null)
    // 2. 新增：一个 ref 用于表示初始认证状态是否已就绪
    const authReady = ref(false)

    // isLoggedin 逻辑保持不变
    const isLoggedIn = computed(() => user.value !== null && user.value !== undefined)

    async function setUser(newUser) {
        user.value = newUser
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
        // 3. 关键：在设置用户状态和档案后，标记认证已就绪
        authReady.value = true
    }

    // updateUserProfile 逻辑保持不变
    async function updateUserProfile(dataToUpdate) {
        if (!profile.value) return;
        const { data, error } = await supabase
            .from('profiles')
            .update(dataToUpdate)
            .eq('id', profile.value.id)
            .select()
            .single();
        if (error) { console.error("更新用户配置失败:", error); }
        else { profile.value = data; }
    }

    // signUp, signIn, signOut 逻辑保持不变
    async function signUp(email, password, nickname) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { nickname: nickname } }
        })
        if (error) throw error
        router.push('/')
    }

    async function signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/')
    }

    async function signOut() {
        await supabase.auth.signOut()
        // setUser(null) 会被 onAuthStateChange 自动触发，这里无需重复调用
        router.push('/login')
    }

    // 4. 新增：一个 Promise，用于在路由守卫中等待
    const waitForAuth = () => {
        return new Promise(resolve => {
            if (authReady.value) {
                resolve()
            } else {
                const unwatch = watch(authReady, (newValue) => {
                    if (newValue) {
                        unwatch()
                        resolve()
                    }
                })
            }
        })
    }

    // 5. 将 Supabase 的认证状态监听器放在这里，作为单一数据源
    supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null)
    })

    return {
        user,
        profile,
        isLoggedIn,
        authReady,      // 导出
        setUser,
        updateUserProfile,
        signUp,
        signIn,
        signOut,
        waitForAuth,    // 导出
    }
})
