<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase/client'

defineProps<{ isOpen: boolean }>()
const emit = defineEmits(['close', 'saved'])

const appointments = ref<any[]>([])
const loading = ref(true)
const selectedAppt = ref<any>(null) // La cita que vamos a cobrar

// Variables de pago
const payForm = ref({ amount: 0, method: 'cash' })
const cashGiven = ref(0)
const changeToReturn = computed(() => {
  if (cashGiven.value < payForm.value.amount) return '0.00'
  return (cashGiven.value - payForm.value.amount).toFixed(2)
})

// Cargar citas PENDIENTES de HOY
onMounted(async () => {
  const today = new Date()
  const start = new Date(today.setHours(0,0,0,0)).toISOString()
  const end = new Date(today.setHours(23,59,59,999)).toISOString()

  const { data } = await supabase
    .from('appointments')
    .select(`
      id, date,
      customers (name),
      services (name, price)
    `)
    .gte('date', start)
    .lt('date', end)
    .neq('status', 'completed') // Que no estén ya cobradas
    .neq('status', 'cancelled') // Ni canceladas
    .order('date', { ascending: true })

  appointments.value = data || []
  loading.value = false
})

// Seleccionar una cita de la lista
const selectAppt = (appt: any) => {
  selectedAppt.value = appt
  payForm.value.amount = appt.services?.price || 0
}

const processPayment = async () => {
  loading.value = true
  
  // 1. Limpiar pagos previos (por seguridad)
  await supabase.from('payments').delete().eq('appointment_id', selectedAppt.value.id)

  // 2. Insertar pago
  const { error } = await supabase.from('payments').insert([{
    appointment_id: selectedAppt.value.id,
    amount: payForm.value.amount,
    method: payForm.value.method
  }])

  if (error) {
    alert('Error: ' + error.message)
  } else {
    // 3. Marcar completada
    await supabase.from('appointments').update({ status: 'completed' }).eq('id', selectedAppt.value.id)
    emit('saved')
    emit('close')
  }
  loading.value = false
}

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
      
      <div class="bg-green-600 p-4 text-white flex justify-between items-center">
        <h3 class="font-bold text-lg">💰 Cobro Rápido</h3>
        <button @click="$emit('close')" class="text-white/80 hover:text-white text-2xl">&times;</button>
      </div>

      <div class="p-6 space-y-4 overflow-y-auto">
        
        <div v-if="!selectedAppt">
          <p class="text-sm text-gray-500 mb-3">Selecciona la cita a cobrar:</p>
          
          <div v-if="loading" class="text-center py-4 text-gray-400">Cargando...</div>
          <div v-else-if="appointments.length === 0" class="text-center py-8 bg-gray-50 rounded-lg text-gray-500">
            ✅ Todo cobrado por hoy.
          </div>

          <div v-else class="space-y-2">
            <div 
              v-for="appt in appointments" 
              :key="appt.id"
              @click="selectAppt(appt)"
              class="p-3 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 cursor-pointer transition flex justify-between items-center group"
            >
              <div>
                <p class="font-bold text-gray-800">{{ appt.customers?.name || 'Sin nombre' }}</p>
                <p class="text-xs text-gray-500">{{ formatTime(appt.date) }} - {{ appt.services?.name }}</p>
              </div>
              <span class="font-bold text-green-600 group-hover:scale-110 transition">{{ appt.services?.price }}€</span>
            </div>
          </div>
        </div>

        <div v-else class="space-y-6 animate-fade-in">
          <button @click="selectedAppt = null" class="text-xs text-gray-400 hover:text-gray-600 mb-2">← Volver a la lista</button>
          
          <div class="text-center">
            <p class="font-bold text-gray-800 text-lg">{{ selectedAppt.customers?.name }}</p>
            <p class="text-gray-500 text-sm">{{ selectedAppt.services?.name }}</p>
            
            <div class="relative inline-block mt-4">
              <input v-model="payForm.amount" type="number" step="0.5" class="text-4xl font-bold text-gray-800 text-center w-40 border-b-2 border-green-500 outline-none py-2">
              <span class="text-xl font-bold text-gray-400 absolute right-0 top-4">€</span>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2">
             <button @click="payForm.method = 'cash'" class="p-2 rounded border-2 text-center text-sm font-bold" :class="payForm.method === 'cash' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'">💵 Efec.</button>
             <button @click="payForm.method = 'card'" class="p-2 rounded border-2 text-center text-sm font-bold" :class="payForm.method === 'card' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'">💳 Tarj.</button>
             <button @click="payForm.method = 'bizum'" class="p-2 rounded border-2 text-center text-sm font-bold" :class="payForm.method === 'bizum' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'">📱 Bizum</button>
          </div>

          <div v-if="payForm.method === 'cash'" class="bg-green-50 p-3 rounded-xl border border-green-100">
            <div class="flex justify-between items-center">
              <span class="text-xs font-bold text-green-700">ENTREGADO:</span>
              <input v-model="cashGiven" type="number" class="w-20 text-right font-bold bg-transparent border-b border-green-500 outline-none">
            </div>
            <div class="flex justify-between items-center mt-2 pt-2 border-t border-green-200">
              <span class="font-bold text-gray-600">CAMBIO:</span>
              <span class="text-xl font-extrabold text-gray-800">{{ changeToReturn }} €</span>
            </div>
          </div>

          <button @click="processPayment" :disabled="loading" class="w-full py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition">
            {{ loading ? '...' : 'COBRAR' }}
          </button>
        </div>

      </div>
    </div>
  </div>
</template>