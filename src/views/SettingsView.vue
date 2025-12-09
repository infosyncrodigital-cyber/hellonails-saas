<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase/client'

const activeTab = ref('store') 
const loading = ref(false)

// DATOS TIENDA
const storeHours = ref<any[]>([])

// DATOS EMPLEADOS
const employees = ref<any[]>([])
const selectedEmployee = ref('')
const employeeShifts = ref<any[]>([])
const employeeVacations = ref<any[]>([]) // <--- NUEVO: Lista de ausencias

// DATOS CUADRANTE
const fullSchedule = ref<any[]>([])

const daysDisplay = [
  { id: 1, name: 'Lunes' }, { id: 2, name: 'Martes' }, { id: 3, name: 'Miércoles' },
  { id: 4, name: 'Jueves' }, { id: 5, name: 'Viernes' }, { id: 6, name: 'Sábado' }, { id: 0, name: 'Domingo' }
]

onMounted(async () => {
  await fetchStoreHours()
  await fetchEmployees()
  await fetchFullSchedule()
})

// --- TIENDA ---
const fetchStoreHours = async () => {
  const { data } = await supabase.from('business_hours').select('*').order('day_of_week')
  storeHours.value = data || []
}
const saveStoreHours = async () => {
  loading.value = true
  const { error } = await supabase.from('business_hours').upsert(storeHours.value)
  loading.value = false
  if (error) alert(error.message)
  else alert('Horario tienda guardado 🏪')
}

// --- EMPLEADOS ---
const fetchEmployees = async () => {
  const { data } = await supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name')
  employees.value = data || []
}

const loadEmployeeShifts = async () => {
  if (!selectedEmployee.value) return
  loading.value = true
  
  // 1. Cargar Turnos
  const { data } = await supabase.from('employee_shifts').select('*').eq('employee_id', selectedEmployee.value)
  
  employeeShifts.value = daysDisplay.map(day => {
    const found = data?.find(d => d.day_of_week === day.id)
    return {
      day_of_week: day.id,
      name: day.name,
      employee_id: selectedEmployee.value,
      is_active: !!found,
      start_time: found?.start_time || '09:00',
      end_time: found?.end_time || '14:00',
      has_split: found?.start_time_2 ? true : false,
      start_time_2: found?.start_time_2 || '16:00',
      end_time_2: found?.end_time_2 || '20:00'
    }
  })

  // 2. Cargar Vacaciones Futuras (NUEVO)
  const today = new Date().toISOString().split('T')[0]
  const { data: vac } = await supabase
    .from('time_off_requests')
    .select('*')
    .eq('employee_id', selectedEmployee.value)
    .eq('status', 'approved') // Solo las aprobadas
    .gte('end_date', today) // Que no hayan terminado aún
    .order('start_date', { ascending: true })
  
  employeeVacations.value = vac || []
  
  loading.value = false
}

const saveEmployeeShifts = async () => {
  if (!selectedEmployee.value) return
  loading.value = true

  await supabase.from('employee_shifts').delete().eq('employee_id', selectedEmployee.value)

  const toInsert = employeeShifts.value
    .filter(s => s.is_active)
    .map(s => ({
      employee_id: selectedEmployee.value,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      start_time_2: s.has_split ? s.start_time_2 : null,
      end_time_2: s.has_split ? s.end_time_2 : null
    }))

  if (toInsert.length > 0) {
    const { error } = await supabase.from('employee_shifts').insert(toInsert)
    if (error) alert(error.message)
    else {
      alert('Turnos guardados 💾')
      fetchFullSchedule()
    }
  } else {
    alert('Turnos eliminados')
    fetchFullSchedule()
  }
  loading.value = false
}

// --- CUADRANTE GENERAL ---
const fetchFullSchedule = async () => {
  const { data: allShifts } = await supabase.from('employee_shifts').select('*')
  
  fullSchedule.value = employees.value.map(emp => {
    const empShifts = allShifts?.filter(s => s.employee_id === emp.id) || []
    
    const weekGrid = daysDisplay.map(day => {
      const shift = empShifts.find(s => s.day_of_week === day.id)
      if (!shift) return { active: false }
      
      let text = `${shift.start_time.slice(0,5)}-${shift.end_time.slice(0,5)}`
      if (shift.start_time_2) {
        text += ` / ${shift.start_time_2.slice(0,5)}-${shift.end_time_2.slice(0,5)}`
      }
      return { active: true, text }
    })
    return { name: emp.full_name, week: weekGrid }
  })
}

// Helpers visuales
const formatDate = (date: string) => new Date(date).toLocaleDateString()
const getTypeEmoji = (type: string) => {
  const map: any = { 'vacation': '🏖️', 'sick_leave': '🤒', 'personal': '👤', 'other': '⚪' }
  return map[type] || '📅'
}
</script>

<template>
  <div class="max-w-7xl mx-auto">
    <h2 class="text-3xl font-bold text-gray-800 mb-6">Configuración</h2>

    <div class="flex border-b border-gray-200 mb-6 overflow-x-auto">
      <button @click="activeTab = 'store'" class="px-6 py-3 font-bold border-b-2 transition-colors whitespace-nowrap" :class="activeTab === 'store' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'">🏪 Tienda</button>
      <button @click="activeTab = 'employees'" class="px-6 py-3 font-bold border-b-2 transition-colors whitespace-nowrap" :class="activeTab === 'employees' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'">👷‍♂️ Turnos</button>
      <button @click="activeTab = 'summary'" class="px-6 py-3 font-bold border-b-2 transition-colors whitespace-nowrap" :class="activeTab === 'summary' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'">📊 Cuadrante</button>
    </div>

    <div v-if="activeTab === 'store'" class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 max-w-4xl">
      <p class="text-gray-500 mb-4 text-sm">Horario de apertura al público.</p>
      <div v-for="day in storeHours" :key="day.id" class="flex items-center gap-4 mb-3 p-2 hover:bg-gray-50 rounded">
        <div class="w-32 font-bold text-gray-700 flex items-center gap-2">
          <input type="checkbox" v-model="day.is_closed" :false-value="false" :true-value="true" class="accent-red-500">
          <span :class="{'line-through text-gray-400': day.is_closed}">{{ ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][day.day_of_week] }}</span>
        </div>
        <div v-if="!day.is_closed" class="flex items-center gap-2">
          <input v-model="day.open_time" type="time" class="border rounded px-2 py-1">
          <span>a</span>
          <input v-model="day.close_time" type="time" class="border rounded px-2 py-1">
        </div>
        <div v-else class="text-red-400 text-sm font-bold italic">CERRADO</div>
      </div>
      <button @click="saveStoreHours" :disabled="loading" class="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 font-bold">Guardar</button>
    </div>

    <div v-else-if="activeTab === 'employees'" class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      
      <div class="mb-6 max-w-md">
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Empleado</label>
        <select v-model="selectedEmployee" @change="loadEmployeeShifts" class="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-primary bg-white">
          <option value="" disabled>-- Elegir --</option>
          <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.full_name }}</option>
        </select>
      </div>

      <div v-if="selectedEmployee" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div class="lg:col-span-2">
          <div v-for="shift in employeeShifts" :key="shift.day_of_week" class="flex flex-col md:flex-row md:items-center gap-4 mb-4 p-3 border rounded-lg bg-gray-50 hover:bg-white hover:shadow-sm transition">
            
            <div class="w-32 flex items-center gap-2">
              <input type="checkbox" v-model="shift.is_active" class="w-5 h-5 accent-green-600 cursor-pointer">
              <span :class="shift.is_active ? 'font-bold text-gray-800' : 'text-gray-400'">{{ shift.name }}</span>
            </div>

            <div v-if="shift.is_active" class="flex flex-col gap-2 flex-1">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-gray-400 w-12">T1:</span>
                <input v-model="shift.start_time" type="time" class="border rounded px-2 py-1 bg-white">
                <span class="text-gray-400">➜</span>
                <input v-model="shift.end_time" type="time" class="border rounded px-2 py-1 bg-white">
              </div>

              <div class="flex items-center gap-2 mt-1">
                <input type="checkbox" v-model="shift.has_split" :id="`split-${shift.day_of_week}`" class="accent-blue-500">
                <label :for="`split-${shift.day_of_week}`" class="text-xs text-blue-600 cursor-pointer hover:underline">
                  {{ shift.has_split ? 'Con turno de tarde' : '+ Tarde' }}
                </label>
              </div>

              <div v-if="shift.has_split" class="flex items-center gap-2 animate-fade-in">
                <span class="text-xs font-bold text-gray-400 w-12">T2:</span>
                <input v-model="shift.start_time_2" type="time" class="border rounded px-2 py-1 bg-white">
                <span class="text-gray-400">➜</span>
                <input v-model="shift.end_time_2" type="time" class="border rounded px-2 py-1 bg-white">
              </div>
            </div>
            <div v-else class="text-gray-300 text-sm italic">Libre</div>
          </div>

          <button @click="saveEmployeeShifts" :disabled="loading" class="mt-4 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold w-full md:w-auto shadow-md">
            💾 Guardar Turnos
          </button>
        </div>

        <div class="lg:col-span-1">
          <div class="bg-blue-50 rounded-xl p-5 border border-blue-100 h-full">
            <h3 class="font-bold text-blue-800 mb-4 flex items-center gap-2">
              📅 Próximas Ausencias
            </h3>
            
            <div v-if="employeeVacations.length > 0" class="space-y-3">
              <div v-for="vac in employeeVacations" :key="vac.id" class="bg-white p-3 rounded-lg border border-blue-100 text-sm shadow-sm">
                <div class="flex justify-between font-bold text-gray-700 mb-1">
                  <span>{{ getTypeEmoji(vac.type) }} {{ formatDate(vac.start_date) }}</span>
                  <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Aprobado</span>
                </div>
                <div class="text-gray-500 text-xs flex justify-between">
                  <span>Hasta: {{ formatDate(vac.end_date) }}</span>
                  <span v-if="vac.type === 'sick_leave'" class="text-red-400">Baja</span>
                </div>
              </div>
            </div>

            <div v-else class="text-center py-10 text-blue-300">
              <p class="text-3xl mb-2">✅</p>
              <p class="text-sm">Sin ausencias previstas próximamente.</p>
            </div>
            
            <div class="mt-6 pt-6 border-t border-blue-200 text-xs text-blue-600">
              <p>💡 <strong>Nota:</strong> Estos días el sistema bloqueará automáticamente las citas, aunque configures turno aquí.</p>
            </div>
          </div>
        </div>

      </div>
      
      <div v-else class="text-center text-gray-400 py-10">👆 Selecciona empleado</div>
    </div>

    <div v-else class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
      <h3 class="font-bold text-gray-800 mb-4">Vista Semanal</h3>
      <table class="w-full text-sm text-left border-collapse">
        <thead>
          <tr class="bg-gray-50 text-gray-500 uppercase text-xs">
            <th class="p-3 border border-gray-100 min-w-[150px]">Empleado</th>
            <th v-for="day in daysDisplay" :key="day.id" class="p-3 border border-gray-100 text-center min-w-[120px]">{{ day.name }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="row in fullSchedule" :key="row.name" class="hover:bg-gray-50">
            <td class="p-3 font-bold text-gray-900 border-r border-gray-100 bg-white sticky left-0">{{ row.name }}</td>
            <td v-for="(day, i) in row.week" :key="i" class="p-2 border-r border-gray-100 text-center">
              <div v-if="day.active" class="bg-green-100 text-green-800 rounded px-1 py-1 text-[10px] font-mono font-bold whitespace-nowrap">{{ day.text }}</div>
              <div v-else class="text-gray-300 text-xs">-</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>