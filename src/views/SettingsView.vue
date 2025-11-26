<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase/client'

const hours = ref<any[]>([])
const loading = ref(true)
const saving = ref(false)

const daysMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// Cargar horarios
const fetchHours = async () => {
  loading.value = true
  const { data, error } = await supabase
    .from('business_hours')
    .select('*')
    .order('day_of_week', { ascending: true })

  if (error) console.error(error)
  else {
    // Ajuste para que Lunes sea el primero en la lista visual (España)
    // Movel el 0 (Domingo) al final
    const sorted = [...(data || [])]
    const sunday = sorted.shift() // Sacamos domingo
    if (sunday) sorted.push(sunday) // Lo ponemos al final
    hours.value = sorted
  }
  loading.value = false
}

// Guardar cambios
const saveSettings = async () => {
  saving.value = true
  
  // Hacemos un update masivo (uno a uno)
  for (const day of hours.value) {
    await supabase
      .from('business_hours')
      .update({
        open_time: day.open_time,
        close_time: day.close_time,
        is_closed: day.is_closed
      })
      .eq('id', day.id)
  }

  alert('¡Horarios actualizados!')
  saving.value = false
}

onMounted(() => {
  fetchHours()
})
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div class="flex justify-between items-center mb-8">
      <div>
        <h2 class="text-3xl font-bold text-gray-800">Configuración</h2>
        <p class="text-gray-500">Define el horario de apertura de la tienda</p>
      </div>
      <button 
        @click="saveSettings" 
        :disabled="saving"
        class="bg-primary text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
      >
        {{ saving ? 'Guardando...' : 'Guardar Cambios' }}
      </button>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div v-if="loading" class="p-8 text-center text-gray-500">Cargando configuración...</div>
      
      <div v-else class="divide-y divide-gray-100">
        <div 
          v-for="day in hours" 
          :key="day.id" 
          class="p-4 flex items-center justify-between hover:bg-gray-50 transition"
          :class="{ 'opacity-50 bg-gray-50': day.is_closed }"
        >
          
          <div class="w-32 font-bold text-gray-700 flex items-center gap-3">
            <input type="checkbox" v-model="day.is_closed" class="w-5 h-5 text-primary rounded focus:ring-primary">
            <span :class="{ 'line-through text-gray-400': day.is_closed }">
              {{ daysMap[day.day_of_week] }}
            </span>
          </div>

          <div class="flex items-center gap-4">
            <div class="flex flex-col">
              <label class="text-xs text-gray-400 mb-1">Apertura</label>
              <input 
                type="time" 
                v-model="day.open_time" 
                :disabled="day.is_closed"
                class="border border-gray-300 rounded px-2 py-1 text-gray-700 disabled:bg-gray-100"
              >
            </div>
            <span class="text-gray-400 mt-4">➜</span>
            <div class="flex flex-col">
              <label class="text-xs text-gray-400 mb-1">Cierre</label>
              <input 
                type="time" 
                v-model="day.close_time" 
                :disabled="day.is_closed"
                class="border border-gray-300 rounded px-2 py-1 text-gray-700 disabled:bg-gray-100"
              >
            </div>
          </div>

          <div class="w-24 text-right text-sm font-medium">
            <span v-if="day.is_closed" class="text-red-500">CERRADO</span>
            <span v-else class="text-green-600">ABIERTO</span>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>