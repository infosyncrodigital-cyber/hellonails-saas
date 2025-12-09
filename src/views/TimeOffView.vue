<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase/client'

const loading = ref(true)
const requests = ref<any[]>([])
const isAdmin = ref(false)
const currentUserId = ref('')

// Formulario Nueva Solicitud
const showModal = ref(false)
const newRequest = ref({
  start_date: '',
  end_date: '',
  type: 'vacation',
  notes: ''
})

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    currentUserId.value = user.id
    const role = localStorage.getItem('userRole')
    isAdmin.value = role === 'admin'
    fetchRequests()
  }
})

const fetchRequests = async () => {
  loading.value = true
  
  let query = supabase
    .from('time_off_requests')
    .select(`
      *,
      profiles (full_name)
    `)
    .order('created_at', { ascending: false })

  // Si NO es admin, solo ve las suyas (aunque el RLS ya protege, esto filtra visualmente)
  if (!isAdmin.value) {
    query = query.eq('employee_id', currentUserId.value)
  }

  const { data, error } = await query
  if (error) console.error(error)
  else requests.value = data || []
  
  loading.value = false
}

const submitRequest = async () => {
  if (!newRequest.value.start_date || !newRequest.value.end_date) return alert('Selecciona fechas')
  
  const { error } = await supabase.from('time_off_requests').insert([{
    employee_id: currentUserId.value,
    ...newRequest.value
  }])

  if (error) alert('Error: ' + error.message)
  else {
    alert('Solicitud enviada 📩')
    showModal.value = false
    fetchRequests()
    // Reset form
    newRequest.value = { start_date: '', end_date: '', type: 'vacation', notes: '' }
  }
}

// Función ADMIN: Cambiar estado
const updateStatus = async (req: any, newStatus: string) => {
  if (!confirm(`¿${newStatus === 'approved' ? 'Aprobar' : 'Rechazar'} esta solicitud?`)) return

  const { error } = await supabase
    .from('time_off_requests')
    .update({ status: newStatus })
    .eq('id', req.id)

  if (error) alert('Error: ' + error.message)
  else fetchRequests()
}

// Función Empleado: Cancelar
const cancelRequest = async (id: string) => {
  if (!confirm('¿Cancelar solicitud?')) return
  await supabase.from('time_off_requests').delete().eq('id', id)
  fetchRequests()
}

// Helpers visuales
const formatDate = (date: string) => new Date(date).toLocaleDateString()
const getTypeLabel = (type: string) => {
  const map: any = { 'vacation': '🏖️ Vacaciones', 'sick_leave': 'baja médica 🤒', 'personal': 'Asuntos Propios 👤', 'other': 'Otro ⚪' }
  return map[type] || type
}
</script>

<template>
  <div class="max-w-5xl mx-auto">
    
    <div class="flex justify-between items-center mb-8">
      <div>
        <h2 class="text-3xl font-bold text-gray-800">Vacaciones y Ausencias</h2>
        <p class="text-gray-500">Gestiona tus días libres y bajas.</p>
      </div>
      <button @click="showModal = true" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm font-bold flex items-center gap-2">
        <span>+</span> Solicitar Días
      </button>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div v-if="loading" class="p-8 text-center text-gray-400">Cargando...</div>
      
      <div v-else-if="requests.length === 0" class="p-12 text-center text-gray-400">
        <p class="text-4xl mb-2">🏖️</p>
        <p>No hay solicitudes registradas.</p>
      </div>

      <table v-else class="w-full text-left text-sm">
        <thead class="bg-gray-50 border-b text-gray-500 uppercase font-bold text-xs">
          <tr>
            <th class="p-4" v-if="isAdmin">Empleado</th>
            <th class="p-4">Tipo</th>
            <th class="p-4">Fechas</th>
            <th class="p-4">Duración</th>
            <th class="p-4">Estado</th>
            <th class="p-4 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 text-gray-700">
          <tr v-for="req in requests" :key="req.id" class="hover:bg-gray-50 transition">
            <td class="p-4 font-bold text-gray-900" v-if="isAdmin">
              {{ req.profiles?.full_name }}
            </td>
            <td class="p-4 capitalize">
              {{ getTypeLabel(req.type) }}
              <p v-if="req.notes" class="text-xs text-gray-400 mt-1 italic">"{{ req.notes }}"</p>
            </td>
            <td class="p-4">
              <div class="flex flex-col">
                <span class="font-bold">{{ formatDate(req.start_date) }}</span>
                <span class="text-xs text-gray-400">hasta</span>
                <span class="font-bold">{{ formatDate(req.end_date) }}</span>
              </div>
            </td>
            <td class="p-4">
              {{ Math.round((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / (1000 * 3600 * 24)) + 1 }} días
            </td>
            <td class="p-4">
              <span v-if="req.status === 'pending'" class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-bold">🟡 Pendiente</span>
              <span v-else-if="req.status === 'approved'" class="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">🟢 Aprobada</span>
              <span v-else class="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">🔴 Rechazada</span>
            </td>
            <td class="p-4 text-right">
              
              <div v-if="isAdmin && req.status === 'pending'" class="flex justify-end gap-2">
                <button @click="updateStatus(req, 'approved')" class="bg-green-50 text-green-600 p-2 rounded hover:bg-green-100" title="Aprobar">✔️</button>
                <button @click="updateStatus(req, 'rejected')" class="bg-red-50 text-red-600 p-2 rounded hover:bg-red-100" title="Rechazar">❌</button>
              </div>

              <button 
                v-if="!isAdmin && req.status === 'pending'" 
                @click="cancelRequest(req.id)"
                class="text-red-400 hover:text-red-600 text-xs underline"
              >
                Cancelar
              </button>

            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-xl font-bold text-gray-800 mb-4">Solicitar Ausencia</h3>
        
        <form @submit.prevent="submitRequest" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo</label>
            <select v-model="newRequest.type" class="w-full border rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-primary">
              <option value="vacation">🏖️ Vacaciones</option>
              <option value="sick_leave">🤒 Baja Médica</option>
              <option value="personal">👤 Asuntos Propios</option>
              <option value="other">⚪ Otro</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Desde</label>
              <input v-model="newRequest.start_date" type="date" class="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary">
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Hasta</label>
              <input v-model="newRequest.end_date" type="date" class="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Motivo (Opcional)</label>
            <textarea v-model="newRequest.notes" rows="2" class="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary resize-none"></textarea>
          </div>

          <div class="flex justify-end gap-2 mt-6">
            <button type="button" @click="showModal = false" class="text-gray-500 hover:bg-gray-100 px-4 py-2 rounded-lg">Cancelar</button>
            <button type="submit" class="bg-primary text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-bold shadow-md">Enviar Solicitud</button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>