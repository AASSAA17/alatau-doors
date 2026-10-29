// Only application-owned SQL is compiled; values are always separate parameters.
export function postgresSql(sql: string) {
  let index = 0;
  const ignore = /INSERT OR IGNORE/i.test(sql);
  sql = sql.replace(/INSERT OR IGNORE/i, 'INSERT');
  sql = sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\b[a-zA-Z_][a-zA-Z_0-9]*\b|\?/g, (token) => {
    if (token === '?') return '$' + ++index;
    if (token[0] === "'" || token[0] === '"') return token;
    if (token === 'rowid') return 'ordinal';
    if (token === 'user' || (/[a-z]/.test(token) && /[A-Z]/.test(token))) return '"' + token + '"';
    return token;
  });
  if (/\b(?:FROM|UPDATE|JOIN)\s+"user"/i.test(sql))
    sql = sql.replace(/\bactive\s*=\s*1\b/g, 'active=true');
  return sql + (ignore ? ' ON CONFLICT DO NOTHING' : '');
}
