<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { supabase } from '../supabase/client'

const loading = ref(true)
const employees = ref<any[]>([])
const selectedEmployeeId = ref('') 
const currentSession = ref<any>(null)
const history = ref<any[]>([])
const currentUserRole = ref('')

// Reloj
const currentTime = ref(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
let timerInterval: any

// Estado para el Warning
const showWarning = ref(false)
const upcomingAppointment = ref<any>(null)
const pendingBreakType = ref('') // Para recordar qué botón pulsó (café o comida)

onMounted(async () => {
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

onUnmounted(() => clearInterval(timerInterval))

watch(selectedEmployeeId, async (newId) => {
  if (!newId) {
    currentSession.value = null
    history.value = []
    return
  }
  await checkStatus(newId)
})

const checkStatus = async (empId: string) => {
  // Buscamos sesión abierta
  const { data } = await supabase.from('time_entries')
    .select('*')
    .eq('employee_id', empId)
    .is('clock_out', null)
    .single()
  
  currentSession.value = data

  // Historial (últimos 5)
  const { data: hist } = await supabase.from('time_entries')
    .select('*')
    .eq('employee_id', empId)
    .not('clock_out', 'is', null)
    .order('clock_in', { ascending: false })
    .limit(5)
  
  history.value = hist || []
}

// --- FUNCIÓN INTELIGENTE: Verificar Citas Próximas ---
const checkUpcomingAppointments = async () => {
  const now = new Date()
  const in30mins = new Date(now.getTime() + 30 * 60000).toISOString()
  
  // Buscar citas confirmadas en los próximos 30 min
  const { data } = await supabase
    .from('appointments')
    .select('id, date, services(name), customers(name)')
    .eq('employee_id', selectedEmployeeId.value)
    .eq('status', 'confirmed') // Solo confirmadas
    .gte('date', now.toISOString())
    .lt('date', in30mins)
    .limit(1) // Con que haya una, basta

  return data && data.length > 0 ? data[0] : null
}

// --- GESTIÓN DE ACCIONES (Entrar, Salir, Pausa) ---
const handleAction = async (type: 'work' | 'break' | 'lunch' | 'stop') => {
  if (!selectedEmployeeId.value) return alert('Selecciona tu nombre')

  // 1. Si queremos hacer PAUSA, verificamos agenda primero
  if (type === 'break' || type === 'lunch') {
    loading.value = true
    const conflict = await checkUpcomingAppointments()
    loading.value = false

    if (conflict) {
      upcomingAppointment.value = conflict
      pendingBreakType.value = type
      showWarning.value = true
      return // Detenemos aquí, esperamos confirmación del modal
    }
  }

  executeAction(type)
}

// Ejecutar la acción (sin chequeos)
const executeAction = async (type: 'work' | 'break' | 'lunch' | 'stop') => {
  loading.value = true
  
  // A. Si hay sesión abierta, la cerramos primero
  if (currentSession.value) {
    await supabase.from('time_entries')
      .update({ clock_out: new Date().toISOString() })
      .eq('id', currentSession.value.id)
  }

  // B. Si la acción NO es 'stop' (salir del todo), abrimos una nueva sesión
  if (type !== 'stop') {
    const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'Móvil' : 'PC'
    await supabase.from('time_entries').insert([{ 
      employee_id: selectedEmployeeId.value, 
      device: `${deviceType} (${currentUserRole.value === 'kiosk' ? 'Kiosco' : 'Personal'})`,
      entry_type: type // Guardamos si es work, break o lunch
    }])
  }

  showWarning.value = false
  await checkStatus(selectedEmployeeId.value)
  loading.value = false
}

const confirmBreakAnyway = () => {
  executeAction(pendingBreakType.value as any)
}

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

// Texto visual según el tipo de sesión actual
const getStatusText = (type: string) => {
  if (type === 'break') return '☕ EN PAUSA'
  if (type === 'lunch') return '🍔 COMIENDO'
  return '🔨 TRABAJANDO'
}
</script>

<template>
  <div class="max-w-md mx-auto mt-6 px-4">
    
    <div class="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden relative">
      
      <div class="bg-gradient-to-r from-blue-600 to-blue-500 p-8 text-white text-center relative">
        <h2 class="text-sm font-medium uppercase tracking-widest opacity-80 mb-2">Control Horario</h2>
        <div class="text-5xl font-mono font-bold tracking-tighter drop-shadow-sm">{{ currentTime }}</div>
        <p class="text-blue-100 text-sm mt-2">{{ new Date().toLocaleDateString() }}</p>
      </div>

      <div class="p-8">
        
        <div v-if="currentUserRole === 'admin' || currentUserRole === 'kiosk'" class="mb-8">
          <label class="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Empleado</label>
          <div class="relative">
            <select v-model="selectedEmployeeId" class="w-full p-4 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
              <option value="" disabled>-- ¿Quién eres? --</option>
              <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.full_name }}</option>
            </select>
          </div>
        </div>

        <div v-if="selectedEmployeeId" class="text-center transition-all duration-500 ease-in-out">
          
          <div v-if="loading" class="py-10 text-gray-300 animate-pulse">Conectando...</div>

          <div v-else>
            
            <div class="relative w-40 h-40 mx-auto mb-8 group cursor-pointer">
              
              <button 
                v-if="!currentSession"
                @click="handleAction('work')"
                class="w-full h-full rounded-full shadow-lg bg-white border-4 border-green-100 text-green-500 hover:border-green-500 hover:bg-green-500 hover:text-white transition-all duration-300 flex flex-col items-center justify-center"
              >
                <span class="text-xl font-bold">ENTRAR</span>
              </button>

              <div v-else class="relative w-full h-full">
                <div class="absolute inset-0 bg-green-400 rounded-full opacity-20 animate-ping" v-if="currentSession.entry_type === 'work'"></div>
                
                <button 
                  v-if="currentSession.entry_type !== 'work'"
                  @click="handleAction('work')"
                  class="absolute inset-0 z-10 w-full h-full rounded-full bg-white border-4 border-orange-100 text-orange-500 hover:bg-orange-500 hover:text-white transition-all flex flex-col items-center justify-center"
                >
                  <span class="text-4xl mb-1">🔙</span>
                  <span class="text-xs font-bold">VOLVER</span>
                </button>

                <button 
                  v-else
                  @click="handleAction('stop')"
                  class="absolute inset-0 z-10 w-full h-full rounded-full bg-white border-4 border-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-all flex flex-col items-center justify-center"
                >
                <span class="text-xl font-bold">SALIR</span>
                </button>
              </div>
            </div>

            <div v-if="currentSession && currentSession.entry_type === 'work'" class="grid grid-cols-2 gap-4 mb-8">
              <button @click="handleAction('break')" class="p-3 rounded-xl bg-orange-50 text-orange-700 font-bold hover:bg-orange-100 transition flex items-center justify-center gap-2">
                ☕ Pausa
              </button>
              <button @click="handleAction('lunch')" class="p-3 rounded-xl bg-orange-50 text-orange-700 font-bold hover:bg-orange-100 transition flex items-center justify-center gap-2">
                🍔 Comer
              </button>
            </div>

            <div class="mb-8">
              <p v-if="currentSession" class="font-medium flex items-center justify-center gap-2" 
                 :class="currentSession.entry_type === 'work' ? 'text-green-600' : 'text-orange-600'">
                <span class="w-2 h-2 rounded-full animate-pulse" :class="currentSession.entry_type === 'work' ? 'bg-green-500' : 'bg-orange-500'"></span>
                {{ getStatusText(currentSession.entry_type) }}
                <span class="text-gray-400 text-sm ml-1">({{ formatTime(currentSession.clock_in) }})</span>
              </p>
              <p v-else class="text-gray-400 text-sm">🔴 Turno cerrado</p>
            </div>

            <div class="border-t border-gray-100 pt-6">
              <ul class="space-y-2">
                <li v-for="h in history" :key="h.id" class="flex justify-between text-sm text-gray-600">
                  <span class="flex items-center gap-2">
                    <span v-if="h.entry_type === 'break'" title="Pausa">☕</span>
                    <span v-else-if="h.entry_type === 'lunch'" title="Comida">🍔</span>
                    <span v-else title="Trabajo">🔨</span>
                    {{ formatDate(h.clock_in) }}
                  </span>
                  <span>{{ formatTime(h.clock_in) }} - {{ h.clock_out ? formatTime(h.clock_out) : '...' }}</span>
                </li>
              </ul>
            </div>

          </div>
        </div>
        
        <div v-else class="py-10 text-center text-gray-300">
          <p>👆 Selecciona un usuario</p>
        </div>

      </div>
    </div>

    <div v-if="showWarning" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div class="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center animate-bounce-in">
        <div class="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
          ⚠️
        </div>
        <h3 class="text-xl font-bold text-gray-800 mb-2">¡Espera un momento!</h3>
        <p class="text-gray-600 mb-4">
          Tienes una cita con <strong>{{ upcomingAppointment?.customers?.name }}</strong> para <strong>{{ upcomingAppointment?.services?.name }}</strong> a las <strong>{{ formatTime(upcomingAppointment?.date) }}</strong>.
        </p>
        <p class="text-sm text-red-500 font-bold mb-6">¿Seguro que quieres hacer una pausa ahora?</p>
        
        <div class="flex gap-3">
          <button @click="showWarning = false" class="flex-1 py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button @click="confirmBreakAnyway" class="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 shadow-lg">
            Sí, me da tiempo
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style>
@keyframes bounce-in {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.animate-bounce-in {
  animation: bounce-in 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}
</style>