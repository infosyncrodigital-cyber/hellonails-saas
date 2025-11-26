<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase/client'

const props = defineProps<{
  isOpen: boolean
  client: any
}>()

const emit = defineEmits(['close'])

const appointments = ref<any[]>([])
const loading = ref(true)

onMounted(async () => {
  if (!props.client?.id) return

  loading.value = true
  
  // Pedimos citas + servicios + PAGOS
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id, date, status, photos, 
      services (name, price, duration),
      payments (amount) 
    `)
    .eq('customer_id', props.client.id)
    .order('date', { ascending: false })

  if (error) console.error(error)
  else appointments.value = data || []
  
  loading.value = false
})

const stats = computed(() => {
  // Solo sumamos las completadas
  const completed = appointments.value.filter(a => a.status === 'completed')
  
  const totalSpent = completed.reduce((sum, a) => {
    // LÓGICA DE SUMA SEGURA
    if (a.payments && a.payments.length > 0) {
      // Si tiene pago registrado, sumamos eso
      return sum + a.payments[0].amount
    } else {
      // Si es antigua y no tiene pago registrado pero está completada, sumamos precio servicio
      return sum + (a.services?.price || 0)
    }
  }, 0)

  const lastVisit = completed.length > 0 ? new Date(completed[0].date).toLocaleDateString() : 'Nunca'
  
  return {
    totalVisits: completed.length,
    totalSpent: totalSpent.toFixed(2),
    lastVisit
  }
})

const formatDate = (iso: string) => {
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

// Función auxiliar para mostrar el precio en la lista
// Función auxiliar para mostrar el precio en la lista
const getPriceDisplay = (appt: any) => {
  // 1. Si hay pago registrado, mostramos ese
  if (appt.payments && appt.payments.length > 0) {
    // Sumamos por si hubiera varios (aunque ya arreglamos eso)
    const paid = appt.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0)
    return paid + '€' // Puedes añadir " (Cobrado)" si quieres, pero igual ensucia visualmente
  }
  
  // 2. Si no hay pago, mostramos el precio del servicio (Tarifa base)
  return (appt.services?.price || 0) + '€'
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
      
      <div class="bg-primary p-6 text-white flex justify-between items-start">
        <div>
          <h2 class="text-2xl font-bold flex items-center gap-2">👤 {{ client.name }}</h2>
          <p class="text-blue-100 mt-1">📞 {{ client.phone }}</p>
        </div>
        <button @click="$emit('close')" class="text-white/70 hover:text-white text-2xl">&times;</button>
      </div>

      <div class="grid grid-cols-3 gap-4 p-6 bg-blue-50 border-b border-blue-100">
        <div class="text-center">
          <p class="text-xs font-bold text-blue-400 uppercase">Visitas</p>
          <p class="text-xl font-bold text-gray-800">{{ stats.totalVisits }}</p>
        </div>
        <div class="text-center border-l border-blue-200">
          <p class="text-xs font-bold text-blue-400 uppercase">Gasto Total</p>
          <p class="text-xl font-bold text-gray-800">{{ stats.totalSpent }}€</p>
        </div>
        <div class="text-center border-l border-blue-200">
          <p class="text-xs font-bold text-blue-400 uppercase">Última vez</p>
          <p class="text-lg font-bold text-gray-800">{{ stats.lastVisit }}</p>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-6 bg-gray-50">
        <h3 class="text-gray-700 font-bold mb-4 sticky top-0 bg-gray-50 pb-2">Historial</h3>
        
        <div v-if="loading" class="text-center text-gray-400 py-4">Cargando...</div>
        <div v-else-if="appointments.length === 0" class="text-center text-gray-400 py-4 italic">Sin citas registradas.</div>

        <div v-else class="space-y-3">
          <div v-for="appt in appointments" :key="appt.id" class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition">
            
            <div class="flex justify-between items-start">
              <div>
                <p class="font-bold text-gray-800">{{ appt.services?.name || 'Servicio eliminado' }}</p>
                <p class="text-xs text-gray-500 mt-1">📅 {{ formatDate(appt.date) }}</p>
              </div>
              <div class="text-right">
                <span class="px-2 py-1 text-xs rounded-full font-medium" 
                  :class="{
                    'bg-green-100 text-green-700': appt.status === 'completed',
                    'bg-blue-100 text-blue-700': appt.status === 'confirmed',
                    'bg-red-100 text-red-700': appt.status === 'cancelled'
                  }">
                  {{ appt.status }}
                </span>
                <p class="text-sm font-bold text-gray-700 mt-1">{{ getPriceDisplay(appt) }}</p>
              </div>
            </div>

            <div v-if="appt.photos && appt.photos.length > 0" class="mt-3 flex gap-2 overflow-x-auto pb-1">
              <a v-for="(photo, i) in appt.photos" :key="i" :href="photo" target="_blank">
                <img :src="photo" class="w-12 h-12 rounded-lg object-cover border border-gray-200 hover:scale-110 transition cursor-zoom-in">
              </a>
            </div>

          </div>
        </div>
      </div>

    </div>
  </div>
</template>