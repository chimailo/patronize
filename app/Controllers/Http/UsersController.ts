import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { rules, schema } from '@ioc:Adonis/Core/Validator'

export default class UsersController {
  public async get({ auth, response }: HttpContextContract) {
    try {
      const { id, email, firstName, lastName, phone, rememberMeToken, createdAt, updatedAt } =
        await auth.authenticate()
      return response.status(200).send({
        status: 'success',
        message: 'Successfuly retrieved your details',
        data: { id, email, firstName, lastName, phone, rememberMeToken, createdAt, updatedAt },
      })
    } catch {
      return response.internalServerError('A server error has occured, please try again.')
    }
  }

  public async update({ request, auth, response }: HttpContextContract) {
    try {
      // validate input
      const validationSchema = schema.create({
        email: schema.string.optional({ trim: true }, [
          rules.email(),
          rules.unique({ table: 'users', column: 'email' }),
        ]),
        firstName: schema.string.optional({ trim: true }, [rules.maxLength(64)]),
        lastName: schema.string.optional({ trim: true }, [rules.maxLength(64)]),
        phone: schema.string.optional({ trim: true }, [rules.maxLength(14)]),
      })

      const { email, firstName, lastName, phone } = await request.validate({
        schema: validationSchema,
      })

      const user = await auth.authenticate()
      user.email = email ? email : user.email
      user.firstName = firstName ? firstName : user.firstName
      user.lastName = lastName ? lastName : user.lastName
      user.phone = phone ? phone : user.phone
      await user.save()

      return response.status(200).send({
        status: 'success',
        message: 'Successfuly updated your details',
        data: user,
      })
    } catch {
      return response.internalServerError('A server error has occured, please try again.')
    }
  }

  public async delete({ auth, response }: HttpContextContract) {
    const user = await auth.authenticate()
    await user.delete()
    return response.status(200).send({
      status: 'success',
      message: 'Successfuly deleted your account',
      data: null,
    })
  }
}
