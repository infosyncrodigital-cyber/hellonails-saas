<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase/client'

const props = defineProps<{
  isOpen: boolean,
  initialDate?: string,
  appointmentToEdit?: any
}>()

const emit = defineEmits(['close', 'saved', 'deleted'])

const clients = ref<any[]>([])
const services = ref<any[]>([])
const employees = ref<any[]>([])
const businessHours = ref<any[]>([]) // Para validar horarios
const loading = ref(false)
const uploading = ref(false)

// Estado de la vista
const viewMode = ref<'form' | 'pay'>('form')
const eventType = ref<'appointment' | 'block'>('appointment')

// Formulario Cita
const form = ref({
  customer_id: '',
  service_id: '',
  employee_id: '',
  date: '',
  duration: 60,
  notes: '',
  photos: [] as string[], // <--- CORRECCIÓN CLAVE: Tipado explícito
  status: 'confirmed'
})

// Formulario Pago
const payForm = ref({
  amount: 0,
  method: 'cash'
})

// Variables para Calculadora de Cambio
const cashGiven = ref(0)
const changeToReturn = computed(() => {
  if (cashGiven.value < payForm.value.amount) return '0.00'
  return (cashGiven.value - payForm.value.amount).toFixed(2)
})

const getLocalISOString = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const offset = date.getTimezoneOffset() * 60000
  const localDate = new Date(date.getTime() - offset)
  return localDate.toISOString().slice(0, 16)
}

// Función auxiliar para sumar minutos
const addMinutes = (date: Date, minutes: number) => {
  return new Date(date.getTime() + minutes * 60000)
}

onMounted(async () => {
  // Cargas iniciales
  const { data: cData } = await supabase.from('customers').select('id, name, phone').order('name')
  const { data: sData } = await supabase.from('services').select('id, name, duration, price').order('name')
  const { data: eData } = await supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name')
  const { data: hData } = await supabase.from('business_hours').select('*') // Horarios
  
  clients.value = cData || []
  services.value = sData || []
  employees.value = eData || []
  businessHours.value = hData || []
  
  if (props.appointmentToEdit) {
    const appt = props.appointmentToEdit
    const isBlock = appt.isBlock || (!appt.customer_id && appt.status === 'blocked')
    eventType.value = isBlock ? 'block' : 'appointment'
    
    form.value = {
      customer_id: appt.customer_id || '',
      service_id: appt.service_id || '',
      employee_id: appt.employee_id || '',
      date: getLocalISOString(appt.date), 
      duration: 60,
      notes: appt.notes || '',
      photos: appt.photos || [], // Cargar fotos
      status: appt.status
    }

    if (appt.service_id) {
      const s = services.value.find(x => x.id === appt.service_id)
      if (s) payForm.value.amount = s.price
    }

  } else if (props.initialDate) {
    form.value.date = getLocalISOString(props.initialDate)
  }
})

const uploadPhoto = async (event: any) => {
  const file = event.target.files[0]
  if (!file) return

  uploading.value = true
  const fileName = `${Date.now()}-${file.name.replace(/\s/g, '')}`
  
  const { error } = await supabase.storage.from('works').upload(fileName, file)

  if (error) {
    alert('Error subiendo foto: ' + error.message)
    uploading.value = false
    return
  }

  const { data } = supabase.storage.from('works').getPublicUrl(fileName)
  form.value.photos.push(data.publicUrl) // Ahora TypeScript no se quejará
  uploading.value = false
}

const removePhoto = (index: number) => {
  form.value.photos.splice(index, 1)
}

const onServiceChange = () => {
  const s = services.value.find(x => x.id === form.value.service_id)
  if (s) payForm.value.amount = s.price
}

const sendWhatsApp = () => {
  const client = clients.value.find(c => c.id === form.value.customer_id)
  if (!client || !client.phone) return alert('Cliente sin teléfono')

  const dateObj = new Date(form.value.date)
  const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })
  const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const service = services.value.find(s => s.id === form.value.service_id)
  const serviceName = service ? service.name : 'tu cita'

  const text = `Hola ${client.name}! 💅 Te recordamos tu cita en Hello Nails para *${serviceName}* el próximo *${dateStr} a las ${timeStr}*. ¿Nos confirmas? Gracias!`
  
  const cleanPhone = client.phone.replace(/\D/g, '')
  const finalPhone = cleanPhone.length === 9 ? `34${cleanPhone}` : cleanPhone
  window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`, '_blank')
}

const save = async () => {
  if (!form.value.employee_id || !form.value.date) return alert('Faltan datos básicos')
  
  if (eventType.value === 'appointment') {
    if (!form.value.customer_id || !form.value.service_id) return alert('Selecciona Cliente y Servicio')
  }

  loading.value = true
  
  // --- VALIDACIÓN HORARIA ---
  const dateObj = new Date(form.value.date)
  const dayOfWeek = dateObj.getDay()
  const dayConfig = businessHours.value.find(d => d.day_of_week === dayOfWeek)

  if (dayConfig) {
    if (dayConfig.is_closed) {
      loading.value = false
      return alert('⛔ La tienda está CERRADA este día.')
    }
    
    const selectedTime = form.value.date.split('T')[1]?.slice(0, 5) || '00:00'
    const openTime = dayConfig.open_time.slice(0, 5)
    const closeTime = dayConfig.close_time.slice(0, 5)

    if (selectedTime < openTime || selectedTime >= closeTime) {
      loading.value = false
      return alert(`⛔ Horario no válido. Abrimos de ${openTime} a ${closeTime}.`)
    }
  }

  // --- VALIDACIÓN SOLAPAMIENTO ---
  const startTime = new Date(form.value.date)
  let duration = form.value.duration || 60
  if (eventType.value === 'appointment') {
    const s = services.value.find(x => x.id === form.value.service_id)
    if (s) duration = s.duration
  }
  const endTime = addMinutes(startTime, duration)

  let query = supabase.from('appointments')
    .select('id, date, services(duration)')
    .eq('employee_id', form.value.employee_id)
    .neq('status', 'cancelled')
    .gte('date', new Date(startTime.getTime() - 24*60*60*1000).toISOString())
    .lt('date', new Date(startTime.getTime() + 24*60*60*1000).toISOString())

  if (props.appointmentToEdit) query = query.neq('id', props.appointmentToEdit.id)

  const { data: clashes } = await query
  const hasClash = clashes?.some((appt: any) => {
    const existingStart = new Date(appt.date)
    const existingDuration = appt.services?.duration || 60 
    const existingEnd = addMinutes(existingStart, existingDuration)
    return startTime < existingEnd && endTime > existingStart
  })

  if (hasClash) {
    loading.value = false
    return alert('⚠️ Este empleado ya está ocupado en ese horario.')
  }

  // --- GUARDADO ---
  const payload: any = {
    employee_id: form.value.employee_id,
    date: startTime.toISOString(),
    notes: form.value.notes,
    photos: form.value.photos, // Guardamos array de fotos
    status: eventType.value === 'block' ? 'blocked' : form.value.status
  }

  if (eventType.value === 'appointment') {
    payload.customer_id = form.value.customer_id
    payload.service_id = form.value.service_id
  } else {
    payload.customer_id = null
    payload.service_id = null
  }

  let error
  if (props.appointmentToEdit) {
    const { error: err } = await supabase.from('appointments').update(payload).eq('id', props.appointmentToEdit.id)
    error = err
  } else {
    const { error: err } = await supabase.from('appointments').insert([payload])
    error = err
  }

  loading.value = false
  if (error) alert(error.message)
  else {
    emit('saved')
    emit('close')
  }
}

const processPayment = async () => {
  if (!props.appointmentToEdit) return
  loading.value = true

  // Borrar pago anterior para no duplicar
  await supabase.from('payments').delete().eq('appointment_id', props.appointmentToEdit.id)

  const { error: payError } = await supabase.from('payments').insert([{
    appointment_id: props.appointmentToEdit.id,
    amount: payForm.value.amount,
    method: payForm.value.method
  }])

  if (payError) {
    alert('Error al cobrar: ' + payError.message)
    loading.value = false
    return
  }

  await supabase.from('appointments').update({ status: 'completed' }).eq('id', props.appointmentToEdit.id)

  loading.value = false
  emit('saved')
  emit('close')
}

const remove = async () => {
  if(!confirm('¿Eliminar?')) return
  await supabase.from('appointments').delete().eq('id', props.appointmentToEdit.id)
  emit('saved')
  emit('close')
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden transition-all transform scale-100 max-h-[90vh] flex flex-col">
      
      <div class="flex border-b border-gray-200 flex-shrink-0" v-if="viewMode === 'form'">
        <button class="flex-1 py-4 text-center font-bold transition-colors" :class="eventType === 'appointment' ? 'bg-white text-primary border-b-2 border-primary' : 'bg-gray-50 text-gray-500'" @click="eventType = 'appointment'">📅 Cita</button>
        <button class="flex-1 py-4 text-center font-bold transition-colors" :class="eventType === 'block' ? 'bg-white text-red-500 border-b-2 border-red-500' : 'bg-gray-50 text-gray-500'" @click="eventType = 'block'">⛔ Bloqueo</button>
      </div>
      
      <div v-else class="bg-green-600 p-4 text-white flex justify-between items-center flex-shrink-0">
        <h3 class="font-bold text-lg">💰 Cerrar y Cobrar</h3>
        <button @click="viewMode = 'form'" class="text-white/80 hover:text-white">Volver</button>
      </div>

      <div class="p-6 space-y-4 overflow-y-auto">
        
        <div v-if="viewMode === 'form'" class="space-y-4">
          
          <div class="grid grid-cols-1 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Empleado/a</label>
              <select v-model="form.employee_id" class="w-full px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-primary outline-none">
                <option value="" disabled>¿Quién atiende?</option>
                <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.full_name }}</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
                <input v-model="form.date" type="datetime-local" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm">
              </div>
              <div v-if="eventType === 'appointment'">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Estado</label>
                <select v-model="form.status" class="w-full px-3 py-2 border rounded-lg bg-white outline-none text-sm">
                  <option value="confirmed">Confirmada</option>
                  <option value="pending">Pendiente</option>
                  <option value="completed">Completada</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>
            </div>
          </div>

          <div v-if="eventType === 'appointment'" class="space-y-4 pt-2 border-t border-dashed">
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Cliente</label>
              <select v-model="form.customer_id" class="w-full px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-primary outline-none">
                <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Servicio</label>
              <select v-model="form.service_id" @change="onServiceChange" class="w-full px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-primary outline-none">
                <option v-for="s in services" :key="s.id" :value="s.id">{{ s.name }} ({{ s.price }}€)</option>
              </select>
            </div>
            
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Notas</label>
              <textarea v-model="form.notes" rows="2" class="w-full px-3 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-primary outline-none" placeholder="Detalles..."></textarea>
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Fotos 📸</label>
              <div class="flex flex-wrap gap-2">
                <div v-for="(photo, index) in form.photos" :key="index" class="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 group">
                  <img :src="photo" class="w-full h-full object-cover">
                  <button @click="removePhoto(index)" type="button" class="absolute top-0 right-0 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-bl">&times;</button>
                </div>
                
                <label class="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary hover:bg-blue-50 transition text-gray-400 hover:text-primary">
                  <span v-if="!uploading" class="text-2xl">+</span>
                  <span v-else class="text-xs animate-pulse">...</span>
                  <input type="file" accept="image/*" class="hidden" @change="uploadPhoto" :disabled="uploading">
                </label>
              </div>
            </div>
          </div>

          <div v-else class="bg-red-50 p-4 rounded-lg border border-red-100">
            <p class="text-sm text-red-600">⚠️ Horario NO disponible.</p>
          </div>

          <div class="flex flex-col-reverse sm:flex-row justify-between items-center mt-6 pt-4 border-t border-gray-100 gap-4">
            <button v-if="appointmentToEdit" @click="remove" class="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition text-sm flex items-center gap-1">
              <span class="text-lg">🗑️</span> <span class="sm:hidden">Eliminar</span>
            </button>
            <div v-else></div>

            <div class="flex flex-wrap justify-end gap-3 w-full sm:w-auto">
              <div class="flex gap-2 mr-2 border-r pr-4 border-gray-200" v-if="appointmentToEdit && eventType === 'appointment'">
                 <button @click="sendWhatsApp" class="bg-green-100 text-green-700 px-3 py-2 rounded-lg font-bold hover:bg-green-200 transition flex items-center gap-1 text-sm" title="WhatsApp">
                  💬 Recordar
                </button>
                <button v-if="form.status !== 'completed'" @click="viewMode = 'pay'" class="bg-yellow-100 text-yellow-700 px-3 py-2 rounded-lg font-bold hover:bg-yellow-200 transition flex items-center gap-1 text-sm" title="Cobrar">
                  💰 Cobrar
                </button>
              </div>

              <button @click="$emit('close')" class="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition text-sm font-medium">Cancelar</button>
              <button @click="save" :disabled="loading" class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 shadow-md disabled:opacity-50 transition text-sm font-bold">
                {{ loading ? 'Guardando...' : (eventType === 'appointment' ? 'Guardar' : 'Bloquear') }}
              </button>
            </div>
          </div>
        </div>

        <div v-else class="space-y-6 py-2">
          <div class="text-center">
            <p class="text-gray-500 mb-1">Importe a cobrar</p>
            <div class="relative inline-block">
              <input v-model="payForm.amount" type="number" step="0.5" class="text-4xl font-bold text-gray-800 text-center w-40 border-b-2 border-green-500 outline-none py-2">
              <span class="text-xl font-bold text-gray-400 absolute right-0 top-4">€</span>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase mb-2 text-center">Método de Pago</label>
            <div class="grid grid-cols-3 gap-2">
              <button @click="payForm.method = 'cash'" class="p-3 rounded-lg border-2 text-center transition" :class="payForm.method === 'cash' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'">💵<br><span class="text-xs font-bold">Efectivo</span></button>
              <button @click="payForm.method = 'card'" class="p-3 rounded-lg border-2 text-center transition" :class="payForm.method === 'card' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'">💳<br><span class="text-xs font-bold">Tarjeta</span></button>
              <button @click="payForm.method = 'bizum'" class="p-3 rounded-lg border-2 text-center transition" :class="payForm.method === 'bizum' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'">📱<br><span class="text-xs font-bold">Bizum</span></button>
            </div>
          </div>

          <div v-if="payForm.method === 'cash'" class="bg-green-50 p-4 rounded-xl border border-green-100 animate-fade-in">
            <div class="flex justify-between items-center mb-2">
              <label class="text-xs font-bold text-green-700 uppercase">Entregado</label>
              <input v-model="cashGiven" type="number" class="w-24 text-right font-bold border-b-2 border-green-500 bg-transparent outline-none text-gray-800">
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-green-200">
              <span class="text-sm font-bold text-gray-600">Cambio:</span>
              <span class="text-xl font-extrabold text-gray-800">{{ changeToReturn }} €</span>
            </div>
          </div>

          <button @click="processPayment" :disabled="loading" class="w-full py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg transform active:scale-95 transition disabled:opacity-50">
            {{ loading ? 'Procesando...' : 'CONFIRMAR PAGO' }}
          </button>
        </div>

      </div>
    </div>
  </div>
</template>