import { Hono } from 'hono'
const app = new Hono()
app.get('/api/documents/*', (c) => {
  return c.text("Param is: " + c.req.param("*"))
})
console.log(app.router.match('GET', '/api/documents/123/456'))
