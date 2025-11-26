<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase/client'
import ClientHistoryModal from '../components/ClientHistoryModal.vue'

// Variables de estado
const clients = ref<any[]>([])
const loading = ref(true)
const searchQuery = ref('')
const showModal = ref(false) // <--- ¡ESTO FALTABA! Controla si se ve la ventana
const isEditing = ref(false)
const isSaving = ref(false)
const currentClient = ref({ id: 0, name: '', phone: '' }) // Datos del formulario

// Nuevas variables para controlar este modal
const showHistory = ref(false)
const selectedClient = ref<any>(null)

// Función para abrir
const openHistory = (client: any) => {
  selectedClient.value = client
  showHistory.value = true
}

// 1. Cargar clientes
const fetchClients = async () => {
  loading.value = true
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name', { ascending: true })
  
  if (error) console.error(error)
  else clients.value = data || []
  
  loading.value = false
}

const cleanText = (text: string) => {
  return text
    .toLowerCase()             // A minúsculas
    .normalize("NFD")          // Descompone letras (ñ -> n + ~)
    .replace(/[\u0300-\u036f]/g, "") // Borra los símbolos raros (tildes, diéresis)
}

// 2. Filtrar (Buscador)
const filteredClients = computed(() => {
  // Limpiamos lo que escribe el usuario
  const query = cleanText(searchQuery.value)
  
  return clients.value.filter(c => {
    // Limpiamos el nombre del cliente de la base de datos
    const clientName = cleanText(c.name)
    
    // Comparamos versiones "limpias"
    return clientName.includes(query) || c.phone.includes(searchQuery.value)
  })
})

// 3. Abrir Modal (Para crear o editar)
const openModal = (client: any = null) => {
  if (client) {
    // Modo Edición
    currentClient.value = { ...client }
    isEditing.value = true
  } else {
    // Modo Crear Nuevo
    currentClient.value = { id: 0, name: '', phone: '' }
    isEditing.value = false
  }
  showModal.value = true
}

// 4. Cerrar Modal
const closeModal = () => {
  showModal.value = false
}

// 5. Guardar (Insertar o Actualizar)
const saveClient = async () => {
  if (!currentClient.value.name || !currentClient.value.phone) return alert('Nombre y Teléfono son obligatorios')
  
  isSaving.value = true
  const clientData = {
    name: currentClient.value.name,
    phone: currentClient.value.phone,
  }

  let error
  if (isEditing.value) {
    // UPDATE
    const { error: err } = await supabase
      .from('customers')
      .update(clientData)
      .eq('id', currentClient.value.id)
    error = err
  } else {
    // INSERT
    const { error: err } = await supabase
      .from('customers')
      .insert([clientData])
    error = err
  }

  isSaving.value = false

  if (error) {
    alert('Error al guardar: ' + error.message)
  } else {
    closeModal() // <--- Ahora sí existe esta función
    fetchClients() // Recargamos la lista
  }
}

// 6. Borrar
const deleteClient = async (id: number) => {
  if(!confirm('¿Seguro? Si borras al cliente, podrías perder el historial de sus citas.')) return
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if(!error) fetchClients()
}

onMounted(() => {
  fetchClients()
})
</script>

<template>
  <div class="max-w-6xl mx-auto">
    
    <div class="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
      <div>
        <h2 class="text-3xl font-bold text-gray-800">Clientes</h2>
        <p class="text-gray-500">Gestión de contactos</p>
      </div>
      
      <div class="flex gap-2 w-full sm:w-auto">
        <div class="relative w-full">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Buscar cliente..." 
            class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-full"
          >
          <span class="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>
        
        <button 
          @click="openModal()" 
          class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm whitespace-nowrap flex items-center gap-2"
        >
          <span>+</span> Nuevo
        </button>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table class="w-full text-left border-collapse">
        <thead class="bg-gray-50 border-b border-gray-200 text-gray-500 text-sm uppercase">
          <tr>
            <th class="p-4 font-semibold">Nombre</th>
            <th class="p-4 font-semibold">Teléfono</th>
            <th class="p-4 font-semibold text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 text-gray-700">
          <tr v-for="client in filteredClients" :key="client.id" class="hover:bg-gray-50 transition group">
            <td class="p-4 font-medium">{{ client.name }}</td>
            <td class="p-4 font-mono text-sm">{{ client.phone }}</td>
            <td class="p-4 text-right space-x-2">
              <button @click="openHistory(client)" class="text-gray-500 hover:text-primary p-2 rounded hover:bg-blue-50 transition" title="Ver Historial">
                📋
              </button>
              <button @click="openModal(client)" class="text-blue-600 hover:text-blue-800 font-medium text-sm px-2 py-1 rounded hover:bg-blue-50 transition">
                Editar
              </button>
              <button @click="deleteClient(client.id)" class="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition" title="Borrar">
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-if="filteredClients.length === 0 && !loading" class="p-12 text-center text-gray-400">
        <p class="text-lg">No se han encontrado clientes.</p>
        <p class="text-sm mt-2">Prueba a añadir uno nuevo.</p>
      </div>
    </div>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
        
        <div class="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 class="text-lg font-bold text-gray-800">
            {{ isEditing ? 'Editar Cliente' : 'Nuevo Cliente' }}
          </h3>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <form @submit.prevent="saveClient" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
            <input 
              v-model="currentClient.name" 
              type="text" 
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="Ej: Laura García"
              required
            >
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Teléfono (WhatsApp)</label>
            <input 
              v-model="currentClient.phone" 
              type="text" 
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="Ej: 600123456"
              required
            >
          </div>

          <div class="flex justify-end gap-3 mt-6">
            <button type="button" @click="closeModal" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
              Cancelar
            </button>
            <button type="submit" :disabled="isSaving" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-50">
              {{ isSaving ? 'Guardando...' : 'Guardar Cliente' }}
            </button>
          </div>
        </form>

      </div>
    </div>
    <ClientHistoryModal
      v-if="showHistory"
      :is-open="showHistory"
      :client="selectedClient"
      @close="showHistory = false"
      />
  </div>
</template>