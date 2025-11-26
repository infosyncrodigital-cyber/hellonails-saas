<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase/client'
import EditTimeEntryModal from '../components/EditTimeEntryModal.vue'

const entries = ref<any[]>([])
const employees = ref<any[]>([])
const loading = ref(true)

// Filtros
const filterEmp = ref('all')
// Ponemos el mes actual por defecto (YYYY-MM)
const filterMonth = ref(new Date().toISOString().slice(0, 7))

// Modal
const showEditModal = ref(false)
const selectedEntry = ref<any>(null)

const fetchData = async () => {
  loading.value = true
  
  const { data: empData } = await supabase.from('profiles').select('*').order('full_name')
  employees.value = empData || []

  const { data: timeData, error } = await supabase
    .from('time_entries')
    .select(`
      id, clock_in, clock_out, device, employee_id,
      profiles (full_name)
    `)
    .order('clock_in', { ascending: false })
    
  if (error) console.error("Error Supabase:", error)
  
  entries.value = timeData || []
  
  // CHIVATO: ¿Cuántos registros hemos bajado en total?
  console.log(`📥 Registros descargados: ${entries.value.length}`)
  
  loading.value = false
}

// Lógica de Filtrado Potente
const filteredEntries = computed(() => {
  const res = entries.value.filter(e => {
    const matchEmp = filterEmp.value === 'all' || e.employee_id === filterEmp.value
    
    // Si el filtro de mes está vacío, lo mostramos todo. Si no, comparamos.
    const entryMonth = e.clock_in.slice(0, 7)
    const matchMonth = !filterMonth.value || entryMonth === filterMonth.value
    
    return matchEmp && matchMonth
  })

  // CHIVATO: ¿Cuántos quedan después de filtrar?
  console.log(`🔍 Filtrados (Mes: ${filterMonth.value}): ${res.length}`)
  
  return res
})

// ... resto de funciones igual (totalHours, openEditModal, etc.) ...
// Calcular Horas Totales
const totalHours = computed(() => {
  let totalMs = 0
  filteredEntries.value.forEach(e => {
    if (e.clock_out) {
      totalMs += new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()
    }
  })
  const hours = Math.floor(totalMs / 3600000)
  const minutes = Math.floor((totalMs % 3600000) / 60000)
  return `${hours}h ${minutes}m`
})

const openEditModal = (entry: any) => {
  selectedEntry.value = entry
  showEditModal.value = true
}

const onEntryUpdated = () => {
  showEditModal.value = false
  fetchData()
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})

onMounted(fetchData)
</script>

<template>
  <div class="max-w-6xl mx-auto">
    
    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
      <div class="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
        <h2 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
          Control Horario
        </h2>
        
        <div class="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 text-blue-800 font-bold">
          Total Periodo: {{ totalHours }}
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Empleado</label>
          <select v-model="filterEmp" class="w-full border p-2.5 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-primary">
            <option value="all">Todos los empleados</option>
            <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.full_name }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Mes</label>
          <input v-model="filterMonth" type="month" class="w-full border p-2.5 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-primary">
        </div>
      </div>
    </div>

    <div class="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table class="w-full text-left text-sm">
        <thead class="bg-gray-50 border-b text-gray-500 uppercase font-bold text-xs">
          <tr>
            <th class="p-4">Empleado</th>
            <th class="p-4">Fecha</th>
            <th class="p-4">Entrada</th>
            <th class="p-4">Salida</th>
            <th class="p-4">Dispositivo</th>
            <th class="p-4 text-right">Editar</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 text-gray-700">
          <tr v-for="entry in filteredEntries" :key="entry.id" class="hover:bg-gray-50 transition">
            <td class="p-4 font-bold text-gray-900">{{ entry.profiles?.full_name }}</td>
            <td class="p-4">{{ formatDate(entry.clock_in) }}</td>
            <td class="p-4 font-mono text-green-600">{{ formatTime(entry.clock_in) }}</td>
            <td class="p-4 font-mono">
              <span v-if="entry.clock_out" class="text-red-600">{{ formatTime(entry.clock_out) }}</span>
              <span v-else class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold">ACTIVO</span>
            </td>
            <td class="p-4 text-xs text-gray-400">{{ entry.device }}</td>
            <td class="p-4 text-right">
              <button @click="openEditModal(entry)" class="text-blue-600 hover:bg-blue-50 p-2 rounded transition">✏️</button>
            </td>
          </tr>
          <tr v-if="filteredEntries.length === 0">
            <td colspan="6" class="p-8 text-center text-gray-400">No hay registros en este periodo.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="md:hidden space-y-4">
      <div v-if="filteredEntries.length === 0" class="text-center text-gray-400 py-8">No hay registros.</div>
      
      <div 
        v-for="entry in filteredEntries" 
        :key="entry.id" 
        class="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center"
      >
        <div>
          <p class="font-bold text-gray-900">{{ entry.profiles?.full_name }}</p>
          <p class="text-xs text-gray-500 mb-2">{{ formatDate(entry.clock_in) }}</p>
          
          <div class="flex items-center gap-3 text-sm">
            <span class="flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded">
              ⬇️ {{ formatTime(entry.clock_in) }}
            </span>
            <span v-if="entry.clock_out" class="flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded">
              ⬆️ {{ formatTime(entry.clock_out) }}
            </span>
            <span v-else class="text-xs font-bold text-green-600 animate-pulse">ACTIVO</span>
          </div>
        </div>

        <button 
          @click="openEditModal(entry)" 
          class="p-3 bg-gray-50 text-blue-600 rounded-lg hover:bg-blue-50 border border-gray-200"
        >
          ✏️
        </button>
      </div>
    </div>

    <EditTimeEntryModal 
      v-if="showEditModal"
      :is-open="showEditModal"
      :entry="selectedEntry"
      @close="showEditModal = false"
      @updated="onEntryUpdated"
    />

  </div>
</template>