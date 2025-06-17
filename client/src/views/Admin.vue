<script setup>
import { ref } from 'vue'
import {
  createUser,
  updateUser,
  blockUser,
  unblockUser,
  resetPassword,
  assignRole,
  removeRole,
} from '../api.js'

const message = ref('')
const newUser = ref({
  first_name: '',
  last_name: '',
  patronymic: '',
  birth_date: '',
  phone: '',
  email: '',
  password: '',
})
const updateData = ref({
  id: '',
  first_name: '',
  last_name: '',
  patronymic: '',
  birth_date: '',
  phone: '',
  email: '',
})
const blockId = ref('')
const unblockId = ref('')
const resetId = ref('')
const newPassword = ref('')
const roleId = ref('')
const roleAlias = ref('')
const removeRoleId = ref('')
const removeRoleAlias = ref('')

function show(msg) {
  message.value = msg
}

async function onCreate() {
  try {
    const { user } = await createUser(newUser.value)
    show(`Создан пользователь ${user.id}`)
  } catch (e) {
    show(e.message)
  }
}

async function onUpdate() {
  try {
    await updateUser(updateData.value.id, updateData.value)
    show('Данные обновлены')
  } catch (e) {
    show(e.message)
  }
}

async function onBlock() {
  try {
    await blockUser(blockId.value)
    show('Пользователь заблокирован')
  } catch (e) {
    show(e.message)
  }
}

async function onUnblock() {
  try {
    await unblockUser(unblockId.value)
    show('Пользователь разблокирован')
  } catch (e) {
    show(e.message)
  }
}

async function onResetPassword() {
  try {
    await resetPassword(resetId.value, newPassword.value)
    show('Пароль обновлен')
  } catch (e) {
    show(e.message)
  }
}

async function onAssignRole() {
  try {
    await assignRole(roleId.value, roleAlias.value)
    show('Роль назначена')
  } catch (e) {
    show(e.message)
  }
}

async function onRemoveRole() {
  try {
    await removeRole(removeRoleId.value, removeRoleAlias.value)
    show('Роль удалена')
  } catch (e) {
    show(e.message)
  }
}
</script>

<template>
  <div class="container mt-5">
    <h1 class="mb-4">Администрирование пользователей</h1>
    <div v-if="message" class="alert alert-info">{{ message }}</div>

    <h2 class="mt-4">Создать пользователя</h2>
    <form @submit.prevent="onCreate" class="row g-2">
      <div class="col-md-4">
        <input v-model="newUser.last_name" class="form-control" placeholder="Фамилия" required />
      </div>
      <div class="col-md-4">
        <input v-model="newUser.first_name" class="form-control" placeholder="Имя" required />
      </div>
      <div class="col-md-4">
        <input v-model="newUser.patronymic" class="form-control" placeholder="Отчество" />
      </div>
      <div class="col-md-3">
        <input v-model="newUser.birth_date" type="date" class="form-control" required />
      </div>
      <div class="col-md-3">
        <input v-model="newUser.phone" class="form-control" placeholder="Телефон" required />
      </div>
      <div class="col-md-3">
        <input v-model="newUser.email" type="email" class="form-control" placeholder="Email" required />
      </div>
      <div class="col-md-3">
        <input v-model="newUser.password" type="password" class="form-control" placeholder="Пароль" required />
      </div>
      <div class="col-12">
        <button class="btn btn-primary">Создать</button>
      </div>
    </form>

    <h2 class="mt-5">Обновить пользователя</h2>
    <form @submit.prevent="onUpdate" class="row g-2">
      <div class="col-md-4">
        <input v-model="updateData.id" class="form-control" placeholder="ID пользователя" required />
      </div>
      <div class="col-md-4">
        <input v-model="updateData.last_name" class="form-control" placeholder="Фамилия" />
      </div>
      <div class="col-md-4">
        <input v-model="updateData.first_name" class="form-control" placeholder="Имя" />
      </div>
      <div class="col-md-4">
        <input v-model="updateData.patronymic" class="form-control" placeholder="Отчество" />
      </div>
      <div class="col-md-4">
        <input v-model="updateData.birth_date" type="date" class="form-control" />
      </div>
      <div class="col-md-4">
        <input v-model="updateData.phone" class="form-control" placeholder="Телефон" />
      </div>
      <div class="col-md-4">
        <input v-model="updateData.email" type="email" class="form-control" placeholder="Email" />
      </div>
      <div class="col-12">
        <button class="btn btn-primary">Обновить</button>
      </div>
    </form>

    <h2 class="mt-5">Блокировка/разблокировка</h2>
    <form @submit.prevent="onBlock" class="row g-2">
      <div class="col-md-6">
        <input v-model="blockId" class="form-control" placeholder="ID" required />
      </div>
      <div class="col-md-6">
        <button class="btn btn-danger">Заблокировать</button>
      </div>
    </form>
    <form @submit.prevent="onUnblock" class="row g-2 mt-2">
      <div class="col-md-6">
        <input v-model="unblockId" class="form-control" placeholder="ID" required />
      </div>
      <div class="col-md-6">
        <button class="btn btn-success">Разблокировать</button>
      </div>
    </form>

    <h2 class="mt-5">Сброс пароля</h2>
    <form @submit.prevent="onResetPassword" class="row g-2">
      <div class="col-md-4">
        <input v-model="resetId" class="form-control" placeholder="ID" required />
      </div>
      <div class="col-md-4">
        <input v-model="newPassword" type="password" class="form-control" placeholder="Новый пароль" required />
      </div>
      <div class="col-md-4">
        <button class="btn btn-warning">Сбросить</button>
      </div>
    </form>

    <h2 class="mt-5">Управление ролями</h2>
    <form @submit.prevent="onAssignRole" class="row g-2">
      <div class="col-md-4">
        <input v-model="roleId" class="form-control" placeholder="ID" required />
      </div>
      <div class="col-md-4">
        <input v-model="roleAlias" class="form-control" placeholder="Роль" required />
      </div>
      <div class="col-md-4">
        <button class="btn btn-primary">Назначить</button>
      </div>
    </form>
    <form @submit.prevent="onRemoveRole" class="row g-2 mt-2">
      <div class="col-md-4">
        <input v-model="removeRoleId" class="form-control" placeholder="ID" required />
      </div>
      <div class="col-md-4">
        <input v-model="removeRoleAlias" class="form-control" placeholder="Роль" required />
      </div>
      <div class="col-md-4">
        <button class="btn btn-secondary">Удалить</button>
      </div>
    </form>
  </div>
</template>
