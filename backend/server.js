require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors()); // Permite que tu Vue (localhost:5173) hable con este server
app.use(express.json());

// Conexión ADMIN a Supabase
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// RUTA: Crear Usuario
app.post('/api/create-user', async (req, res) => {
  const { email, password, name, role } = req.body;

  console.log(`👤 Creando usuario: ${email} (${role})`);

  try {
    // 1. Crear el usuario en el sistema de Autenticación
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true // Lo confirmamos automáticamente para que pueda entrar ya
    });

    if (authError) throw authError;

    // 2. Crear la ficha en la tabla pública 'profiles'
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([
        {
          id: authData.user.id, // Usamos el mismo ID
          email: email,
          full_name: name,
          role: role, // 'admin' o 'employee'
          color: req.body.color || '#3B82F6'
        }
      ]);

    if (profileError) throw profileError;

    console.log('✅ Usuario creado con éxito');
    res.status(200).json({ message: 'Usuario creado correctamente', user: authData.user });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// RUTA: Dar de Baja (Soft Delete - Solución PRO)
app.delete('/api/delete-user/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`🛑 Dando de baja usuario: ${id}`);

  try {
    // 1. Marcar perfil como INACTIVO en la base de datos pública
    // Esto hace que no salga en los desplegables de citas/fichaje
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: false })
      .eq('id', id);
    
    if (profileError) throw profileError;

    // 2. Bloquear acceso al sistema (Banear usuario en Auth)
    // Esto impide que pueda iniciar sesión, pero NO borra sus datos antiguos
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      id, 
      { ban_duration: '876600h' } // Banear por 100 años (aprox)
    );
    
    if (authError) throw authError;

    res.status(200).json({ message: 'Usuario dado de baja correctamente' });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(400).json({ error: 'No se pudo dar de baja: ' + error.message });
  }
});

// RUTA: Editar Perfil (Nombre, Color, Rol)
// Nota: Cambiar email/password es complejo, mejor borrar y crear de nuevo si se equivocan en eso.
// Pero cambiar nombre/color sí lo hacemos fácil.
app.put('/api/update-user/:id', async (req, res) => {
  const { id } = req.params;
  const { name, role, color } = req.body;

  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ full_name: name, role, color })
      .eq('id', id);

    if (error) throw error;
    res.status(200).json({ message: 'Actualizado' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// RUTA: Restaurar Usuario (Reactivar)
app.put('/api/restore-user/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`♻️ Restaurando usuario: ${id}`);

  try {
    // 1. Marcar perfil como ACTIVO
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: true })
      .eq('id', id);
    
    if (profileError) throw profileError;

    // 2. Quitar el Ban en Auth (Poniendo ban_duration a 0)
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      id, 
      { ban_duration: '0s' } 
    );
    
    if (authError) throw authError;

    res.status(200).json({ message: 'Usuario reactivado correctamente' });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(400).json({ error: 'No se pudo restaurar: ' + error.message });
  }
});

// Arrancar
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API de Hello Nails escuchando en http://localhost:${PORT}`);
});