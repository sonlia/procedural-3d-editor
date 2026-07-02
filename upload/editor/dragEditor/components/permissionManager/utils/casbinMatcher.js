// Casbin 匹配器 - 前端模拟实现

export function keyMatch(key1, key2) {
  if (!key1) return false
  if (!key2) return false
  if (key1 === key2) return true

  const pattern = key2.replace(/\*/g, '.*').replace(/\//g, '\\/')
  const regex = new RegExp('^' + pattern + '$')
  return regex.test(key1)
}

export function keyMatch2(key1, key2) {
  if (!key1) return false
  if (!key2) return false
  if (key1 === key2) return true

  let pattern = key2
  pattern = pattern.replace(/:\w+/g, '([^/]+)')
  pattern = pattern.replace(/\*/g, '.*')
  pattern = pattern.replace(/\//g, '\\/')

  const regex = new RegExp('^' + pattern + '$')
  return regex.test(key1)
}

export function keyMatch3(key1, key2) {
  if (!key1) return false
  if (!key2) return false
  if (key1 === key2) return true

  let pattern = key2
  pattern = pattern.replace(/\{\w+\}/g, '([^/]+)')
  pattern = pattern.replace(/\*/g, '.*')
  pattern = pattern.replace(/\//g, '\\/')

  const regex = new RegExp('^' + pattern + '$')
  return regex.test(key1)
}

export function regexMatch(key1, key2) {
  if (!key1) return false
  if (!key2) return false

  try {
    const regex = new RegExp(key2)
    return regex.test(key1)
  } catch (e) {
    console.error('Invalid regex pattern:', key2, e)
    return false
  }
}

export function globMatch(key1, key2) {
  if (!key1) return false
  if (!key2) return false
  if (key1 === key2) return true

  let pattern = key2
  pattern = pattern.replace(/\*\*/g, '__DOUBLE_STAR__')
  pattern = pattern.replace(/\*/g, '[^/]*')
  pattern = pattern.replace(/__DOUBLE_STAR__/g, '.*')
  pattern = pattern.replace(/\//g, '\\/')

  const regex = new RegExp('^' + pattern + '$')
  return regex.test(key1)
}

export function getMatchFunction(matchType) {
  if (matchType === 'keyMatch') return keyMatch
  if (matchType === 'keyMatch2') return keyMatch2
  if (matchType === 'keyMatch3') return keyMatch3
  if (matchType === 'regex') return regexMatch
  if (matchType === 'glob') return globMatch

  return function exactMatch(key1, key2) {
    return key1 === key2
  }
}

export function enforce(policies, request, options) {
  if (!options) options = {}

  const sub = request.sub
  const dom = request.dom
  const obj = request.obj
  const act = request.act
  const matchType = options.matchType || 'keyMatch2'
  const matchFn = getMatchFunction(matchType)

  const matched = []
  for (let i = 0; i < policies.length; i++) {
    const p = policies[i]
    const subMatch = p.sub === sub
    const domMatch = p.dom === dom
    const objMatch = p.obj === obj || matchFn(obj, p.obj)
    const actMatch = p.act === act || p.act === '*'

    if (subMatch && domMatch && objMatch && actMatch) {
      matched.push(p)
    }
  }

  let hasDeny = false
  let hasAllow = false
  for (let i = 0; i < matched.length; i++) {
    if (matched[i].eft === 'deny') hasDeny = true
    if (matched[i].eft === 'allow') hasAllow = true
  }

  return hasAllow && !hasDeny
}

export function batchEnforce(policies, requests, options) {
  const results = []
  for (let i = 0; i < requests.length; i++) {
    results.push(enforce(policies, requests[i], options))
  }
  return results
}

export function getEffectivePermissions(policies, sub, dom) {
  const matched = []
  for (let i = 0; i < policies.length; i++) {
    const p = policies[i]
    if (p.sub === sub && p.dom === dom) {
      matched.push(p)
    }
  }

  const grouped = {}
  for (let i = 0; i < matched.length; i++) {
    const p = matched[i]
    const key = p.obj + ':' + p.act
    if (!grouped[key]) {
      grouped[key] = []
    }
    grouped[key].push(p)
  }

  const effective = []
  const keys = Object.keys(grouped)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const ps = grouped[key]

    let hasDeny = false
    let hasAllow = false
    for (let j = 0; j < ps.length; j++) {
      if (ps[j].eft === 'deny') hasDeny = true
      if (ps[j].eft === 'allow') hasAllow = true
    }

    const parts = key.split(':')
    const obj = parts[0]
    const act = parts[1]

    if (hasAllow && !hasDeny) {
      effective.push({ obj: obj, act: act, eft: 'allow' })
    } else if (hasDeny) {
      effective.push({ obj: obj, act: act, eft: 'deny' })
    }
  }

  return effective
}

export function testUrlMatch(urlPattern, testUrl, matchType) {
  if (!matchType) matchType = 'keyMatch2'

  const matchFn = getMatchFunction(matchType)
  const matched = matchFn(testUrl, urlPattern)

  return {
    matched: matched,
    pattern: urlPattern,
    testUrl: testUrl,
    matchType: matchType,
    explanation: matched
      ? '✓ ' + testUrl + ' 匹配模式 ' + urlPattern
      : '✗ ' + testUrl + ' 不匹配模式 ' + urlPattern
  }
}
