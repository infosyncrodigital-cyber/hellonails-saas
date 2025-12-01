<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { supabase } from '../supabase/client'

const loading = ref(true)
const employees = ref<any[]>([])
const selectedEmployeeId = ref('') 
const currentSession = ref<any>(null)
const history = ref<any[]>([])
const currentUserRole = ref('')

// Reloj en tiempo real
const currentTime = ref(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
let timerInterval: any

// 1. Carga Inicial
onMounted(async () => {
  // Reloj
  timerInterval = setInterval(() => {
    currentTime.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }, 1000)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  currentUserRole.value = localStorage.getItem('userRole') || 'employee'

  if (currentUserRole.value === 'admin' || currentUserRole.value === 'kiosk') {
    const { data } = await supabase.from('profiles').select('id, full_name').neq('role', 'kiosk').eq('is_active', true).order('full_name')
    employees.value = data || []
  } else {
    selectedEmployeeId.value = user.id
    await checkStatus(user.id)
  }
  loading.value = false
})

onUnmounted(() => {
  clearInterval(timerInterval)
})

watch(selectedEmployeeId, async (newId) => {
  if (!newId) {
    currentSession.value = null
    history.value = []
    return
  }
  await checkStatus(newId)
})

// ... (Lógica de checkStatus, clockIn, clockOut igual que antes) ...
const checkStatus = async (empId: string) => {
  const { data } = await supabase.from('time_entries').select('*').eq('employee_id', empId).is('clock_out', null).single()
  currentSession.value = data

  const { data: hist } = await supabase.from('time_entries').select('*').eq('employee_id', empId).not('clock_out', 'is', null).order('clock_in', { ascending: false }).limit(5)
  history.value = hist || []
}

const clockIn = async () => {
  if (!selectedEmployeeId.value) return alert('Selecciona tu nombre')
  const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'Móvil' : 'PC'
  const { error } = await supabase.from('time_entries').insert([{ employee_id: selectedEmployeeId.value, device: `${deviceType} (${currentUserRole.value === 'kiosk' ? 'Kiosco' : 'Personal'})` }])
  if (error) alert('Error: ' + error.message)
  else await checkStatus(selectedEmployeeId.value)
}

const clockOut = async () => {
  if (!currentSession.value) return
  const { error } = await supabase.from('time_entries').update({ clock_out: new Date().toISOString() }).eq('id', currentSession.value.id)
  if (error) alert('Error: ' + error.message)
  else await checkStatus(selectedEmployeeId.value)
}

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
</script>

<template>
  <div class="max-w-md mx-auto mt-6 px-4">
    
    <div class="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden relative">
      
      <div class="bg-gradient-to-r from-blue-600 to-blue-500 p-8 text-white text-center relative overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        
        <h2 class="text-sm font-medium uppercase tracking-widest opacity-80 mb-2">Control Horario</h2>
        <div class="text-5xl font-mono font-bold tracking-tighter drop-shadow-sm">
          {{ currentTime }}
        </div>
        <p class="text-blue-100 text-sm mt-2">{{ new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }}</p>
      </div>

      <div class="p-8">
        
        <div v-if="currentUserRole === 'admin' || currentUserRole === 'kiosk'" class="mb-8">
          <label class="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Selecciona Empleado</label>
          <div class="relative">
            <select 
              v-model="selectedEmployeeId" 
              class="w-full p-4 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none transition-shadow shadow-inner"
            >
              <option value="" disabled>-- ¿Quién eres? --</option>
              <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.full_name }}</option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>

        <div v-if="selectedEmployeeId" class="text-center transition-all duration-500 ease-in-out">
          
          <div v-if="loading" class="py-10 text-gray-300 animate-pulse">Conectando...</div>

          <div v-else>
            <div class="relative w-40 h-40 mx-auto mb-6 group cursor-pointer">
              <div v-if="currentSession" class="absolute inset-0 bg-green-400 rounded-full opacity-20 animate-ping"></div>
              <div class="absolute inset-0 rounded-full transition-all duration-300 transform group-hover:scale-105"
                   :class="currentSession ? 'bg-red-50' : 'bg-green-50'"></div>
              
              <button 
                @click="currentSession ? clockOut() : clockIn()"
                class="absolute inset-2 rounded-full shadow-lg flex flex-col items-center justify-center transition-all duration-300 border-4"
                :class="currentSession 
                  ? 'bg-white border-red-100 text-red-500 group-hover:border-red-500 group-hover:bg-red-500 group-hover:text-white' 
                  : 'bg-white border-green-100 text-green-500 group-hover:border-green-500 group-hover:bg-green-500 group-hover:text-white'"
              >
                <!-- <span class="text-4xl mb-1">{{ currentSession ? '⏹️' : '▶️' }}</span> -->
                <span class="text-xl font-bold uppercase tracking-wider">{{ currentSession ? 'SALIR' : 'ENTRAR' }}</span>
              </button>
            </div>

            <div class="mb-8">
              <p v-if="currentSession" class="text-green-600 font-medium flex items-center justify-center gap-2">
                <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Trabajando desde {{ formatTime(currentSession.clock_in) }}
              </p>
              <p v-else class="text-gray-400 text-sm">Actualmente fuera de servicio</p>
            </div>

            <div class="border-t border-gray-100 pt-6">
              <p class="text-xs font-bold text-gray-400 uppercase mb-4 text-left ml-1">Últimos registros</p>
              <ul class="space-y-3">
                <li v-for="h in history" :key="h.id" class="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-blue-50 transition-colors">
                  <div class="flex items-center gap-3">
                    <span class="text-gray-400 text-xs font-mono">{{ formatDate(h.clock_in) }}</span>
                    <span class="font-bold text-gray-700">{{ formatTime(h.clock_in) }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-gray-300">➜</span>
                    <span class="font-bold text-gray-700">{{ h.clock_out ? formatTime(h.clock_out) : '...' }}</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
        
        <div v-else class="py-10 text-center text-gray-300">
          <!-- <div class="text-4xl mb-2">👆</div> -->
          <p class="text-xl">Selecciona un usuario</p>
        </div>

      </div>
    </div>
  </div>
</template>