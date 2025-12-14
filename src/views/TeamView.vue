<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase/client'

const employees = ref<any[]>([])
const loading = ref(true)
const showModal = ref(false)
const showInactive = ref(false)
const newUser = ref({ email: '', password: '', name: '', phone: '', role: 'employee', color: '#3B82F6' })
const isCreating = ref(false)
const isEditingMode = ref(false) 
const currentUserId = ref('')

// 1. Cargar la lista
const fetchTeam = async () => {
  loading.value = true
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) console.error(error)
  else employees.value = data || []
  
  loading.value = false
}

// Computed para filtrar la lista
const visibleEmployees = computed(() => {
  if (showInactive.value) return employees.value
  return employees.value.filter(e => e.is_active)
})

// --- CORREGIDO: Función Abrir Modal para CREAR ---
const openCreate = () => {
  isEditingMode.value = false
  // Limpiamos el formulario
  newUser.value = { 
    email: '', 
    password: '', 
    name: '', 
    phone: '',
    role: 'employee', 
    color: '#3B82F6' 
  }
  showModal.value = true
}

// --- CORREGIDO: Función Abrir Modal para EDITAR ---
const openEdit = (emp: any) => {
  isEditingMode.value = true
  currentUserId.value = emp.id
  // Rellenamos con los datos del empleado clickado
  newUser.value = {
    email: emp.email,
    password: '', // La contraseña se deja vacía (solo se envía si se quiere cambiar)
    name: emp.full_name,
    phone: emp.phone,
    role: emp.role,
    color: emp.color || '#3B82F6'
  }
  showModal.value = true
}

// Función PROCESAR (Guardar)
const handleSubmit = async () => {
  // Validación: Si es crear, pass obligatorio. Si es editar, opcional.
  if (!newUser.value.email || (!isEditingMode.value && !newUser.value.password)) {
     return alert('Faltan datos obligatorios')
  }
  
  isCreating.value = true

  try {
    if (isEditingMode.value) {
      // EDITAR (PUT)
      const response = await fetch(`/api/update-user/${currentUserId.value}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser.value)
      })
      
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Error actualizando')
      
    } else {
      // CREAR (POST)
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser.value)
      })
      
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Error creando')
    }

    alert(isEditingMode.value ? 'Actualizado correctamente' : 'Creado correctamente')
    showModal.value = false
    fetchTeam() // Recargar lista
    
  } catch (error: any) {
    alert('Error: ' + error.message)
  }
  
  isCreating.value = false
}

// Función DAR DE BAJA
const deleteEmployee = async (emp: any) => {
  if (!emp.is_active) return alert('Este usuario ya está dado de baja.')
  
  if(!confirm(`¿Dar de baja a ${emp.full_name}? \n\nSu historial se mantendrá, pero no podrá acceder.`)) return
  
  await fetch(`/api/delete-user/${emp.id}`, { method: 'DELETE' })
  fetchTeam()
}

// Función RESTAURAR
const restoreEmployee = async (id: string) => {
  if(!confirm('¿Reactivar a este empleado? Podrá volver a entrar.')) return
  await fetch(`/api/restore-user/${id}`, { method: 'PUT' })
  fetchTeam()
}

onMounted(() => {
  fetchTeam()
})
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <div class="flex justify-between items-center mb-8">
      <div>
        <h2 class="text-3xl font-bold text-gray-800">Equipo</h2>
        <div class="flex items-center gap-2 mt-1">
          <p class="text-gray-500">Gestiona el acceso</p>
          <label class="flex items-center gap-2 cursor-pointer ml-4 text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full hover:bg-gray-200 transition">
            <input type="checkbox" v-model="showInactive" class="accent-primary">
            Ver Bajas
          </label>
        </div>
      </div>
      <button @click="openCreate" class="...">
        + Añadir Empleado
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div 
        v-for="emp in visibleEmployees" 
        :key="emp.id" 
        class="bg-white p-6 rounded-xl shadow-sm border flex items-center gap-4 transition"
        :class="emp.is_active ? 'border-gray-200' : 'border-red-200 bg-red-50 opacity-75'"
      >
        <div 
          class="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shrink-0"
          :class="emp.is_active ? 'bg-blue-100 text-primary' : 'bg-gray-300 text-gray-500'"
        >
          {{ emp.full_name ? emp.full_name.charAt(0).toUpperCase() : 'U' }}
        </div>
        
        <div class="overflow-hidden flex-1">
          <h3 class="font-bold text-gray-800 truncate flex items-center gap-2">
            {{ emp.full_name || 'Usuario' }}
            <span v-if="!emp.is_active" class="text-[10px] uppercase bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-bold">Baja</span>
          </h3>
          <p class="text-sm text-gray-500 truncate">{{ emp.email }}</p>
          <p class="text-sm text-gray-500 truncate">{{ emp.phone }}</p>
          
          <span 
            v-if="emp.is_active"
            class="inline-block mt-1 px-2 py-0.5 text-xs rounded-full font-medium"
            :class="emp.role === 'admin' ? 'bg-purple-100 text-purple-700' : (emp.role === 'kiosk' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700')"
          >
            {{ emp.role === 'admin' ? 'Administrador' : (emp.role === 'kiosk' ? 'Kiosco' : 'Empleado') }}
          </span>
        </div>

        <div class="ml-auto flex flex-col gap-2">
          <button @click="openEdit(emp)" class="text-blue-500 hover:bg-blue-50 p-2 rounded" title="Editar">✏️</button>
          
          <button 
            v-if="emp.is_active" 
            @click="deleteEmployee(emp)" 
            class="text-red-500 hover:bg-red-50 p-2 rounded" 
            title="Dar de Baja"
          >
            🚫
          </button>
          
          <button 
            v-else 
            @click="restoreEmployee(emp.id)" 
            class="text-green-500 hover:bg-green-50 p-2 rounded" 
            title="Reactivar"
          >
            ♻️
          </button>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-xl font-bold text-gray-800 mb-4">
          {{ isEditingMode ? 'Editar Empleado' : 'Nuevo Empleado' }}
        </h3>
        
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="text-sm font-medium text-gray-700">Nombre</label>
            <input v-model="newUser.name" type="text" class="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary">
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Teléfono (WhatsApp)</label>
            <input 
              v-model="newUser.phone" 
              type="tel" 
              placeholder="Ej: 666111222"
              class="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary"
            >
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Email</label>
            <input v-model="newUser.email" type="email" class="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary" :disabled="isEditingMode">
          </div>
          <div v-if="!isEditingMode">
            <label class="text-sm font-medium text-gray-700">Contraseña Provisional</label>
            <input v-model="newUser.password" type="text" class="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary">
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Color en Calendario</label>
            <div class="flex gap-2 mt-1">
              <input type="color" v-model="newUser.color" class="h-10 w-20 p-1 rounded border cursor-pointer">
              <span class="text-sm text-gray-500 self-center">{{ newUser.color }}</span>
            </div>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Rol</label>
            <select v-model="newUser.role" class="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary bg-white">
              <option value="employee">Empleado (Acceso Limitado)</option>
              <option value="admin">Administrador (Acceso Total)</option>
              <option value="kiosk">🖥️ Kiosco (Solo Fichar)</option>
            </select>
          </div>

          <div class="flex justify-end gap-2 mt-6">
            <button type="button" @click="showModal = false" class="text-gray-500 hover:bg-gray-100 px-4 py-2 rounded-lg">Cancelar</button>
            <button type="submit" :disabled="isCreating" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              {{ isCreating ? 'Guardando...' : (isEditingMode ? 'Guardar Cambios' : 'Crear Usuario') }}
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>