/**
 * Vuetify 2 组件示例
 * Vue 3 改法: Vuetify 3 (v-data-table → v-data-table-server, v-slot 改 #header 等)
 */
<template>
  <div class="vuetify-demo">
    <v-app>
      <v-app-bar app color="primary" dark>
        <v-app-bar-title>Vuetify 2 Demo</v-app-bar-title>
      </v-app-bar>

      <v-main>
        <v-container>
          <v-card>
            <v-card-title>Data Table</v-card-title>
            <v-data-table
              :headers="headers"
              :items="desserts"
              :items-per-page="5"
              class="elevation-1"
            >
              <template v-slot:item.calories="{ item }">
                <v-chip :color="getColor(item.calories)" dark>
                  {{ item.calories }}
                </v-chip>
              </template>
              <template v-slot:item.actions="{ item }">
                <v-icon small @click="editItem(item)">mdi-pencil</v-icon>
                <v-icon small @click="deleteItem(item)">mdi-delete</v-icon>
              </template>
            </v-data-table>
          </v-card>

          <v-form ref="form" v-model="valid">
            <v-text-field
              v-model="name"
              :rules="nameRules"
              label="Name"
              required
            />
            <v-text-field
              v-model="email"
              :rules="emailRules"
              label="E-mail"
              required
            />
            <v-btn :disabled="!valid" @click="submit">Submit</v-btn>
          </v-form>

          <v-dialog v-model="dialog" max-width="500">
            <v-card>
              <v-card-title>Confirm</v-card-title>
              <v-card-text>Are you sure?</v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn @click="dialog = false">Cancel</v-btn>
                <v-btn color="primary" @click="confirm">OK</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
        </v-container>
      </v-main>
    </v-app>
  </div>
</template>

<script>
export default {
  name: 'VuetifyDemo',
  data() {
    return {
      valid: false,
      name: '',
      email: '',
      nameRules: [v => !!v || 'Name is required'],
      emailRules: [
        v => !!v || 'E-mail is required',
        v => /.+@.+\..+/.test(v) || 'E-mail must be valid'
      ],
      dialog: false,
      headers: [
        { text: 'Dessert', value: 'name' },
        { text: 'Calories', value: 'calories' },
        { text: 'Actions', value: 'actions', sortable: false }
      ],
      desserts: [
        { name: 'Frozen Yogurt', calories: 159 },
        { name: 'Ice cream sandwich', calories: 237 },
        { name: 'Eclair', calories: 262 }
      ]
    }
  },
  methods: {
    getColor(calories) {
      if (calories > 250) return 'red'
      if (calories > 200) return 'orange'
      return 'green'
    },
    editItem(item) { console.log('edit', item) },
    deleteItem(item) { this.dialog = true },
    submit() { console.log('submit') },
    confirm() { this.dialog = false }
  }
}
</script>
