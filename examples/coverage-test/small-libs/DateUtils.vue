<template>
  <div class="date-utils">
    <h2>日期处理</h2>
    <p>今天: {{ today }}</p>
    <p>格式化: {{ formattedToday }}</p>
    <p>3 天后: {{ threeDaysLater }}</p>
    <p>距离年底: {{ daysToYearEnd }} 天</p>

    <input type="date" v-model="dateInput" />
    <p>选择的日期: {{ parsedDate }}</p>

    <ul>
      <li v-for="event in events" :key="event.id">
        {{ event.name }} - {{ formatEvent(event.date) }}
      </li>
    </ul>
  </div>
</template>

<script>
import { format, addDays, parseISO, differenceInDays, isAfter, isBefore, startOfDay, endOfYear } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'

export default {
  name: 'DateUtils',
  data() {
    return {
      dateInput: '2024-01-01',
      events: [
        { id: 1, name: '项目启动', date: '2024-01-15' },
        { id: 2, name: '中期评审', date: '2024-06-30' },
        { id: 3, name: '项目交付', date: '2024-12-15' }
      ]
    }
  },
  computed: {
    today() {
      return format(new Date(), 'yyyy-MM-dd')
    },
    formattedToday() {
      return format(new Date(), 'yyyy年MM月dd日 EEEE', { locale: zhCN })
    },
    threeDaysLater() {
      return format(addDays(new Date(), 3), 'yyyy-MM-dd')
    },
    daysToYearEnd() {
      return differenceInDays(endOfYear(new Date()), new Date())
    },
    parsedDate() {
      try {
        return format(parseISO(this.dateInput), 'yyyy年MM月dd日')
      } catch {
        return 'invalid'
      }
    }
  },
  methods: {
    formatEvent(date) {
      return format(parseISO(date), 'yyyy-MM-dd EEEE', { locale: zhCN })
    },
    isUpcoming(date) {
      return isAfter(parseISO(date), new Date())
    },
    isPast(date) {
      return isBefore(parseISO(date), new Date())
    }
  }
}
</script>
