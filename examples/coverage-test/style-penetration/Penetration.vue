<template>
  <div class="container">
    <!-- >>>> 穿透语法 (Vue 2 旧, Vue 3 删) -->
    <div class="raw-penetrator">
      <child-component />
    </div>

    <!-- /deep/ 穿透 (Vue 2 旧, Vue 3 删) -->
    <div class="deep-penetrator">
      <el-table class="inner-table" />
    </div>

    <!-- ::v-deep 穿透 (Vue 2.6+, Vue 3 改 :deep()) -->
    <div class="v-deep-penetrator">
      <el-input class="custom-input" />
    </div>

    <!-- ::v-deep() 带参数 (Vue 2.6+, Vue 3 改 :deep()) -->
    <div class="v-deep-paren-penetrator">
      <el-select class="custom-select" />
    </div>

    <!-- 混合穿透 -->
    <div class="mixed-penetrator">
      <el-dialog class="custom-dialog">
        <div class="dialog-body">
          <el-form class="inner-form" />
        </div>
      </el-dialog>
    </div>

    <!-- 多级嵌套穿透 -->
    <div class="nested-penetrator">
      <el-card class="card-wrapper">
        <div class="card-header">
          <el-button class="header-btn" />
        </div>
        <div class="card-body">
          <el-table class="body-table">
            <el-table-column class="table-col" />
          </el-table>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script>
import ChildComponent from './ChildComponent.vue'

export default {
  name: 'StylePenetration',
  components: { ChildComponent }
}
</script>

<style scoped>
/* === >>> 穿透 (Vue 2 only, Vue 3 删) === */
.raw-penetrator >>> .child-inner {
  color: red;
}

.raw-penetrator >>> .child-title {
  font-size: 16px;
  font-weight: bold;
}

.raw-penetrator >>> .child-list li {
  padding: 5px 0;
}

/* === /deep/ 穿透 (Vue 2 only, Vue 3 删) === */
.deep-penetrator /deep/ .el-table__header {
  background-color: #f5f5f5;
}

.deep-penetrator /deep/ .el-table__row {
  height: 50px;
}

.deep-penetrator /deep/ .el-table__row:hover {
  background-color: #e8f4ff;
}

.deep-penetrator /deep/ .el-table .cell {
  padding: 0 10px;
}

/* === ::v-deep 穿透 (Vue 2.6+, Vue 3 改 :deep()) === */
.v-deep-penetrator ::v-deep .el-input__inner {
  border-radius: 8px;
  height: 40px;
}

.v-deep-penetrator ::v-deep .el-input__prefix {
  left: 10px;
}

.v-deep-penetrator ::v-deep .el-input__suffix {
  right: 10px;
}

/* === ::v-deep() 带参 (Vue 2.6+, Vue 3 改 :deep()) === */
.v-deep-paren-penetrator ::v-deep(.el-select-dropdown) {
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
}

.v-deep-paren-penetrator ::v-deep(.el-select-dropdown__item) {
  padding: 0 20px;
  height: 40px;
  line-height: 40px;
}

.v-deep-paren-penetrator ::v-deep(.el-select-dropdown__item.hover) {
  background-color: #f5f7fa;
}

/* === 混合穿透 (同文件多种语法) === */
.mixed-penetrator >>> .el-dialog__header {
  padding: 20px;
}

.mixed-penetrator /deep/ .el-dialog__body {
  padding: 10px 20px;
}

.mixed-penetrator ::v-deep .el-dialog__footer {
  text-align: center;
}

.mixed-penetrator ::v-deep .inner-form .el-form-item__label {
  font-weight: bold;
}

.mixed-penetrator >>> .dialog-body {
  min-height: 200px;
}

/* === 多级嵌套穿透 === */
.nested-penetrator >>> .card-wrapper .el-card__header {
  border-bottom: 2px solid #409eff;
}

.nested-penetrator /deep/ .card-header .header-btn {
  float: right;
}

.nested-penetrator ::v-deep .card-body .body-table {
  width: 100%;
}

.nested-penetrator ::v-deep .body-table .el-table__header th {
  background: #fafafa;
}

.nested-penetrator ::v-deep .body-table .table-col .cell {
  text-align: center;
}

.nested-penetrator >>> .el-card {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
}
</style>
