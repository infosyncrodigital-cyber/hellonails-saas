<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase/client'

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const router = useRouter()

const handleLogin = async () => {
  loading.value = true
  errorMsg.value = ''

  // 1. Autenticación Básica
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })

  if (authError) {
    errorMsg.value = 'Email o contraseña incorrectos.'
    loading.value = false
    return
  }

  // 2. BUSCAR EL ROL (Esto es lo nuevo)
  // Consultamos la tabla 'profiles' para saber quién es este usuario
  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single()

  // 3. Guardar el rol en memoria para usarlo en la app
  const userRole = profileData?.role || 'employee'
  localStorage.setItem('userRole', userRole)

  // 4. Entrar
  router.push('/')
  loading.value = false
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-10 border border-gray-100">
      
      <div class="text-center mb-10">
        <div class="text-4xl mb-2">💅</div> 
        <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">Hello Nails</h1>
        <p class="text-gray-500 mt-2 text-sm">Gestión inteligente de tu negocio</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">Correo Electrónico</label>
          <input 
            v-model="email" 
            type="email" 
            required 
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-gray-50 focus:bg-white"
            placeholder="tu@email.com"
          >
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">Contraseña</label>
          <input 
            v-model="password" 
            type="password" 
            required 
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-gray-50 focus:bg-white"
            placeholder="••••••••"
          >
        </div>

        <div v-if="errorMsg" class="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg font-medium border border-red-100">
          {{ errorMsg }}
        </div>

        <button 
          type="submit" 
          :disabled="loading"
          class="w-full py-3.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover transform active:scale-95 transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
        >
          <span v-if="loading" class="animate-spin">⚪</span>
          {{ loading ? 'Entrando...' : 'Iniciar Sesión' }}
        </button>
      </form>
    </div>
  </div>
</template>