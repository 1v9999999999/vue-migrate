/**
 * PrimeVue 3 组件示例
 * Vue 3 改法: PrimeVue 4 (template 语法更严格, v-slot 改 #header)
 */
<template>
  <div class="primevue-demo">
    <Toolbar>
      <template #start>
        <Button label="New" icon="pi pi-plus" @click="create" />
      </template>
      <template #end>
        <SplitButton label="Save" :model="items" />
      </template>
    </Toolbar>

    <DataTable
      :value="products"
      :paginator="true"
      :rows="10"
      :rowsPerPageOptions="[5, 10, 20]"
      paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
      currentPageReportTemplate="Showing {first} to {last} of {totalRecords} products"
      :globalFilterFields="['name', 'category']"
      v-model:selection="selectedProducts"
      dataKey="id"
    >
      <template #header>
        <div class="table-header">
          <h3>Products</h3>
          <span class="p-input-icon-left">
            <i class="pi pi-search" />
            <InputText v-model="search" placeholder="Search..." />
          </span>
        </div>
      </template>
      <Column selectionMode="multiple" style="width: 3em" />
      <Column field="name" header="Name" sortable />
      <Column field="category" header="Category" sortable />
      <Column field="price" header="Price" sortable>
        <template #body="slotProps">
          {{ formatCurrency(slotProps.data.price) }}
        </template>
      </Column>
      <Column header="Actions">
        <template #body="slotProps">
          <Button icon="pi pi-pencil" @click="edit(slotProps.data)" />
          <Button icon="pi pi-trash" severity="danger" @click="confirmDelete(slotProps.data)" />
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="showDialog" header="Edit Product" :modal="true" :style="{ width: '450px' }">
      <div class="p-field">
        <label>Name</label>
        <InputText v-model="editingProduct.name" />
      </div>
      <template #footer>
        <Button label="Cancel" @click="showDialog = false" />
        <Button label="Save" @click="save" />
      </template>
    </Dialog>
  </div>
</template>

<script>
export default {
  name: 'PrimeVueDemo',
  data() {
    return {
      search: '',
      selectedProducts: [],
      showDialog: false,
      editingProduct: { name: '', category: '', price: 0 },
      products: [
        { id: 1, name: 'Apple', category: 'Fruit', price: 1.5 },
        { id: 2, name: 'Bread', category: 'Bakery', price: 3.0 }
      ],
      items: [
        { label: 'Save', icon: 'pi pi-save' },
        { label: 'Save As', icon: 'pi pi-copy' }
      ]
    }
  },
  methods: {
    formatCurrency(v) { return `$${v.toFixed(2)}` },
    create() { this.editingProduct = { name: '', category: '', price: 0 }; this.showDialog = true },
    edit(p) { this.editingProduct = { ...p }; this.showDialog = true },
    save() { this.showDialog = false },
    confirmDelete(p) { console.log('delete', p) }
  }
}
</script>
