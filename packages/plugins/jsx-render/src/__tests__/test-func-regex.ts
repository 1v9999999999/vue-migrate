// test the regex
const source = `<template functional>
  <div>{{ msg }}</div>
</template>`

const result = source.replace(
  /<template(\s+[^>]*?)?\s*functional(\s+[^>]*?)?>/gi,
  (match, before = ' ', after = '') => {
    console.log('match:', JSON.stringify(match))
    console.log('before:', JSON.stringify(before))
    console.log('after:', JSON.stringify(after))
    const beforeClean = (before || '').replace(/\s+$/, '').replace(/^\s+/, '')
    const afterClean = (after || '').replace(/^\s+/, '')
    const attrs = [beforeClean, afterClean].filter(Boolean).join(' ')
    return `<template ${attrs}>`.replace(/\s+>/, '>')
  },
)
console.log('result:', JSON.stringify(result))
