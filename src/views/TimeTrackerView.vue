<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { supabase } from '../supabase/client'

const loading = ref(true)
const employees = ref<any[]>([])
const selectedEmployeeId = ref('') 
const currentSession = ref<any>(null)
const history = ref<any[]>([])

// Estado del usuario actual
const currentUserRole = ref('')
const currentUserId = ref('')

// 1. Configuración Inicial Inteligente
onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  currentUserId.value = user.id
  currentUserRole.value = localStorage.getItem('userRole') || 'employee'

  // CARGAR LISTA DE EMPLEADOS
  // Si es Kiosco o Admin: Cargamos a TODOS para el desplegable
  if (currentUserRole.value === 'admin' || currentUserRole.value === 'kiosk') {
    const { data } = await supabase.from('profiles').select('id, full_name').neq('role', 'kiosk').eq('is_active', true).order('full_name')
    employees.value = data || []
  } 
  // Si es Empleado normal: Solo se carga a sí mismo
  else {
    // Autoseleccionamos al usuario logueado
    selectedEmployeeId.value = user.id
    // Cargamos su estado directamente
    await checkStatus(user.id)
  }
  
  loading.value = false
})

// 2. Observador (Solo útil para modo Kiosco)
watch(selectedEmployeeId, async (newId) => {
  if (!newId) {
    currentSession.value = null
    history.value = []
    return
  }
  await checkStatus(newId)
})

const checkStatus = async (empId: string) => {
  // loading.value = true // Opcional: quitar para que no parpadee tanto en kiosco
  
  // Buscar sesión abierta
  const { data } = await supabase
    .from('time_entries')
    .select('*')
    .eq('employee_id', empId)
    .is('clock_out', null)
    .single()

  currentSession.value = data

  // Cargar historial
  const { data: hist } = await supabase
    .from('time_entries')
    .select('*')
    .eq('employee_id', empId)
    .not('clock_out', 'is', null)
    .order('clock_in', { ascending: false })
    .limit(5)
  
  history.value = hist || []
  // loading.value = false
}

const clockIn = async () => {
  if (!selectedEmployeeId.value) return alert('Selecciona tu nombre')
  
  const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'Móvil' : 'PC'

  const { error } = await supabase.from('time_entries').insert([{
    employee_id: selectedEmployeeId.value,
    device: `${deviceType} (${currentUserRole.value === 'kiosk' ? 'Kiosco' : 'Personal'})`
  }])

  if (error) alert('Error: ' + error.message)
  else await checkStatus(selectedEmployeeId.value)
}

const clockOut = async () => {
  if (!currentSession.value) return

  const { error } = await supabase
    .from('time_entries')
    .update({ clock_out: new Date().toISOString() })
    .eq('id', currentSession.value.id)

  if (error) alert('Error: ' + error.message)
  else await checkStatus(selectedEmployeeId.value)
}

// Utils
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
const formatDate = (iso: string) => new Date(iso).toLocaleDateString()
</script>

<template>
  <div class="max-w-lg mx-auto text-center mt-6">
    
    <div class="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">Control Horario</h2>

      <div v-if="currentUserRole === 'admin' || currentUserRole === 'kiosk'" class="mb-8">
        <label class="block text-sm font-bold text-gray-700 mb-2 text-left">¿Quién eres?</label>
        <select 
          v-model="selectedEmployeeId" 
          class="w-full p-4 text-lg border-2 border-gray-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white transition"
        >
          <option value="" disabled>-- Selecciona tu nombre --</option>
          <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.full_name }}</option>
        </select>
      </div>

      <div v-if="selectedEmployeeId">
        
        <div v-if="currentSession">
          <div class="bg-green-50 border border-green-100 rounded-xl p-6 mb-6 animate-pulse-slow">
            <p class="text-green-800 font-bold text-lg">🟢 JORNADA EN CURSO</p>
            <p class="text-green-600 mt-2">Entrada: <strong>{{ formatTime(currentSession.clock_in) }}</strong></p>
          </div>
          
          <button @click="clockOut" class="w-full py-5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg transform active:scale-95 transition text-xl flex items-center justify-center gap-2">
            SALIR
          </button>
        </div>

        <div v-else>
          <div class="bg-gray-50 border border-gray-100 rounded-xl p-6 mb-6">
            <p class="text-gray-500 font-medium">🔴 Actualmente no estás trabajando</p>
          </div>

          <button @click="clockIn" class="w-full py-5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-lg transform active:scale-95 transition text-xl flex items-center justify-center gap-2">
            ENTRAR
          </button>
        </div>

        <div class="mt-8 pt-6 border-t border-gray-100 text-left opacity-75 hover:opacity-100 transition">
          <p class="text-xs font-bold text-gray-400 uppercase mb-3">Últimos movimientos</p>
          <ul class="space-y-2 text-sm text-gray-600">
            <li v-for="h in history" :key="h.id" class="flex justify-between">
              <span>{{ formatDate(h.clock_in) }}</span>
              <span>{{ formatTime(h.clock_in) }} - {{ h.clock_out ? formatTime(h.clock_out) : '...' }}</span>
            </li>
          </ul>
        </div>

      </div>
      
      <div v-else class="py-10 text-gray-400 italic">
        Selecciona tu nombre arriba para empezar.
      </div>

    </div>
  </div>
</template>

<style>
.animate-pulse-slow {
  animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>