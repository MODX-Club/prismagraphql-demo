const { GraphQLServer } = require('graphql-yoga')
const { Prisma } = require('prisma-binding')

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')


function getUserId(ctx) {
  
  const Authorization = ctx.request.get('Authorization')
  
  if (Authorization) {
    const token = Authorization.replace('Bearer ', '')
    const { userId } = jwt.verify(token, process.env.APP_SECRET)
    return userId
  }

  return null;
}

class AuthError extends Error {
  constructor() {
    super('Not authorized')
  }
}


const resolvers = {
  Query: {
    feed(parent, args, ctx, info) {
      return ctx.db.query.posts({ where: { isPublished: true } }, info)
    },
    drafts(parent, args, ctx, info) {
      return ctx.db.query.posts({ where: { isPublished: false } }, info)
    },
    post(parent, { id }, ctx, info) {
      return ctx.db.query.post({ where: { id: id } }, info)
    },

    users(parent, args, ctx, info) {
      return ctx.db.query.users({}, info)
    },

    me(parent, args, ctx, info) {
      
      const id = getUserId(ctx)

      return id && ctx.db.query.user({ where: { id } }, info) || null;
    },

  },
  Mutation: {
    
    createDraft(parent, { title, text }, ctx, info) {
      
      const userId = getUserId(ctx)

      const author = userId && {
        connect: { id: userId },
      } || undefined;

      return ctx.db.mutation.createPost(
        { data: { 
          title, 
          text, 
          isPublished: false,
          author,
        } },
        info,
      )
    },

    deletePost(parent, { id }, ctx, info) {
      return ctx.db.mutation.deletePost({where: { id } }, info)
    },
    publish(parent, { id }, ctx, info) {
      return ctx.db.mutation.updatePost(
        {
          where: { id },
          data: { isPublished: true },
        },
        info,
      )
    },
    async createUser(parent, { name, email, password }, ctx, info){

      password = await bcrypt.hash(password, 10);

      return ctx.db.mutation.createUser(
        { data: { name, email, password } },
        info,
      )
    },

    async login(parent, { email, password }, ctx, info) {
      const user = await ctx.db.query.user({ where: { email } })
      if (!user) {
        throw new Error(`No such user found for email: ${email}`)
      }
  
      const valid = await bcrypt.compare(password, user.password)
      if (!valid) {
        throw new Error('Invalid password')
      }
  
      return {
        token: jwt.sign({ userId: user.id }, process.env.APP_SECRET),
        user,
      }
    },

  },
}

const server = new GraphQLServer({
  typeDefs: './src/schema.graphql',
  resolvers,
  context: req => ({
    ...req,
    db: new Prisma({
      typeDefs: 'src/generated/prisma.graphql',
      endpoint: 'http://localhost:4466/hello-world/dev',
      secret: 'mysecret123',
      debug: true,
    }),
  }),
})

server.start(() => console.log('Server is running on http://localhost:4000'))
