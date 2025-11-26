<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase/client'

const props = defineProps<{
  isOpen: boolean
  entry: any // El fichaje que vamos a editar
}>()

const emit = defineEmits(['close', 'updated'])
const loading = ref(false)

const form = ref({
  clock_in: '',
  clock_out: '' as string | null
})

// Helper para formatear la fecha a lo que pide el input (YYYY-MM-DDTHH:mm)
const toLocalInput = (isoStr: string) => {
  if (!isoStr) return ''
  const date = new Date(isoStr)
  const offset = date.getTimezoneOffset() * 60000
  const localDate = new Date(date.getTime() - offset)
  return localDate.toISOString().slice(0, 16)
}

onMounted(() => {
  if (props.entry) {
    form.value.clock_in = toLocalInput(props.entry.clock_in)
    form.value.clock_out = props.entry.clock_out ? toLocalInput(props.entry.clock_out) : null
  }
})

const save = async () => {
  if (!form.value.clock_in) return alert('La hora de entrada es obligatoria')
  
  loading.value = true

  // Convertir de vuelta a UTC para Supabase
  const updates = {
    clock_in: new Date(form.value.clock_in).toISOString(),
    clock_out: form.value.clock_out ? new Date(form.value.clock_out).toISOString() : null
  }

  const { error } = await supabase
    .from('time_entries')
    .update(updates)
    .eq('id', props.entry.id)

  loading.value = false

  if (error) {
    alert('Error: ' + error.message)
  } else {
    emit('updated') // Avisamos al padre para que refresque la tabla
    emit('close')
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
      
      <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 class="text-lg font-bold text-gray-800">Editar Fichaje</h3>
          <p class="text-sm text-gray-500 flex items-center gap-1">
            👤 {{ entry.profiles?.full_name }}
          </p>
        </div>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
      </div>

      <div class="p-6 space-y-5">
        
        <div>
          <label class="block text-xs font-bold text-green-700 uppercase mb-1">Entrada (Inicio)</label>
          <input 
            v-model="form.clock_in" 
            type="datetime-local" 
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
          >
        </div>

        <div>
          <label class="block text-xs font-bold text-red-700 uppercase mb-1">Salida (Fin)</label>
          <input 
            v-model="form.clock_out" 
            type="datetime-local" 
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
          >
          <p class="text-xs text-gray-400 mt-1">Deja esto vacío si aún está trabajando.</p>
        </div>

        <div class="flex justify-end gap-3 pt-4">
          <button 
            @click="$emit('close')" 
            class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition"
          >
            Cancelar
          </button>
          <button 
            @click="save" 
            :disabled="loading"
            class="px-6 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 font-bold transition disabled:opacity-50"
          >
            {{ loading ? 'Guardando...' : 'Guardar Cambios' }}
          </button>
        </div>

      </div>
    </div>
  </div>
</template>