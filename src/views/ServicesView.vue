<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase/client' // Importamos tu conexión

// Variables reactivas
const services = ref<any[]>([]) // Aquí guardaremos la lista
const loading = ref(true)
const newService = ref({ name: '', duration: 60, price: 0 }) // Para el formulario
const isCreating = ref(false) // Para saber si estamos enviando datos

// 1. FUNCIÓN: Cargar Servicios (READ)
const loadServices = async () => {
  loading.value = true
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('name', { ascending: true }) // Ordenar alfabéticamente

  if (error) console.error('Error cargando:', error)
  else services.value = data || []
  
  loading.value = false
}

// 2. FUNCIÓN: Añadir Servicio (CREATE)
const addService = async () => {
  if (!newService.value.name) return alert('Ponle un nombre al servicio')
  
  isCreating.value = true
  
  const { error } = await supabase
    .from('services')
    .insert([{ 
      name: newService.value.name,
      duration: newService.value.duration,
      price: newService.value.price
    }])

  if (error) {
    alert('Error al guardar: ' + error.message)
  } else {
    // Limpiamos el formulario y recargamos la lista
    newService.value = { name: '', duration: 60, price: 0 }
    await loadServices() 
  }
  isCreating.value = false
}

// 3. FUNCIÓN: Borrar Servicio (DELETE)
const deleteService = async (id: number) => {
  if (!confirm('¿Seguro que quieres eliminar este servicio?')) return

  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)

  if (error) alert('Error al borrar')
  else await loadServices() // Recargamos la lista para que desaparezca
}

// Cargar los datos nada más entrar
onMounted(() => {
  loadServices()
})
</script>
<template>
  <div class="max-w-5xl mx-auto">
    
    <div class="flex justify-between items-center mb-8">
      <div>
        <h2 class="text-3xl font-bold text-gray-800">Mis Servicios</h2>
        <p class="text-gray-500">Gestiona el catálogo de tratamientos</p>
      </div>
    </div>

    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
      <h3 class="text-lg font-semibold text-gray-700 mb-4">Añadir Nuevo Servicio</h3>
      <form @submit.prevent="addService" class="flex flex-wrap gap-4 items-end">
        
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input v-model="newService.name" type="text" placeholder="Ej: Manicura Francesa" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" required>
        </div>

        <div class="w-32">
          <label class="block text-sm font-medium text-gray-700 mb-1">Duración (min)</label>
          <input v-model="newService.duration" type="number" step="5" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
        </div>

        <div class="w-32">
          <label class="block text-sm font-medium text-gray-700 mb-1">Precio (€)</label>
          <input v-model="newService.price" type="number" step="0.5" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
        </div>

        <button type="submit" :disabled="isCreating" class="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {{ isCreating ? 'Guardando...' : 'Añadir' }}
        </button>
      </form>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div v-if="loading" class="p-8 text-center text-gray-500">Cargando datos...</div>
      
      <table v-else class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
            <th class="p-4 font-semibold border-b">Nombre del Servicio</th>
            <th class="p-4 font-semibold border-b w-32">Duración</th>
            <th class="p-4 font-semibold border-b w-32">Precio</th>
            <th class="p-4 font-semibold border-b w-20 text-right">Acción</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="service in services" :key="service.id" class="hover:bg-gray-50 transition-colors group">
            <td class="p-4 font-medium text-gray-800">{{ service.name }}</td>
            <td class="p-4 text-gray-600">
              <span class="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold">{{ service.duration }} min</span>
            </td>
            <td class="p-4 text-gray-600 font-semibold">{{ service.price }} €</td>
            <td class="p-4 text-right">
              <button @click="deleteService(service.id)" class="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors" title="Eliminar">
                🗑️
              </button>
            </td>
          </tr>
          <tr v-if="services.length === 0">
            <td colspan="4" class="p-8 text-center text-gray-400 italic">
              No hay servicios creados. ¡Añade el primero arriba!
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>