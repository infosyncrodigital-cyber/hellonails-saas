<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase/client'
import EditTimeEntryModal from '../components/EditTimeEntryModal.vue' // <--- IMPORTAR

const entries = ref<any[]>([])
const employees = ref<any[]>([])
const loading = ref(true)
const filterEmp = ref('all')

// Variables para el Modal
const showEditModal = ref(false)
const selectedEntry = ref<any>(null)

const fetchData = async () => {
  loading.value = true
  
  const { data: empData } = await supabase.from('profiles').select('*')
  employees.value = empData || []

  const { data: timeData } = await supabase
    .from('time_entries')
    .select(`
      id, clock_in, clock_out, device, employee_id,
      profiles (full_name)
    `)
    .order('clock_in', { ascending: false })
    
  entries.value = timeData || []
  loading.value = false
}

const filteredEntries = computed(() => {
  if (filterEmp.value === 'all') return entries.value
  return entries.value.filter(e => e.employee_id === filterEmp.value)
})

// Función actualizada: Ahora solo abre el modal
const openEditModal = (entry: any) => {
  selectedEntry.value = entry
  showEditModal.value = true
}

// Función para cerrar y recargar
const onEntryUpdated = () => {
  showEditModal.value = false
  fetchData()
}

onMounted(fetchData)
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-3xl font-bold text-gray-800">Reporte de Horas</h2>
      <select v-model="filterEmp" class="border p-2 rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary">
        <option value="all">Todos los empleados</option>
        <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.full_name }}</option>
      </select>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table class="w-full text-left text-sm">
        <thead class="bg-gray-50 border-b text-gray-500 uppercase font-bold text-xs">
          <tr>
            <th class="p-4">Empleado</th>
            <th class="p-4">Fecha</th>
            <th class="p-4">Entrada</th>
            <th class="p-4">Salida</th>
            <th class="p-4">Dispositivo</th>
            <th class="p-4 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 text-gray-700">
          <tr v-for="entry in filteredEntries" :key="entry.id" class="hover:bg-gray-50 transition">
            <td class="p-4 font-bold text-gray-900">{{ entry.profiles?.full_name }}</td>
            <td class="p-4">{{ new Date(entry.clock_in).toLocaleDateString() }}</td>
            
            <td class="p-4 font-mono text-green-600">
              {{ new Date(entry.clock_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) }}
            </td>
            
            <td class="p-4 font-mono text-red-600">
              <span v-if="entry.clock_out">{{ new Date(entry.clock_out).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) }}</span>
              <span v-else class="text-green-600 font-bold text-xs bg-green-100 px-2 py-1 rounded">ACTIVO</span>
            </td>

            <td class="p-4 text-xs text-gray-500">{{ entry.device }}</td>
            
            <td class="p-4 text-right">
              <button 
                @click="openEditModal(entry)" 
                class="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded font-medium transition border border-blue-200"
              >
                ✏️ Editar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
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