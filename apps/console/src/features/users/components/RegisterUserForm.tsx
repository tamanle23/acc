import * as React from 'react'
import { GlassCard } from '@acc/ui'
import { useRegisterUserFacade } from '../api/useRegisterUserFacade'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function RegisterUserForm() {
  const { mutate: registerUser, isPending, error } = useRegisterUserFacade()
  const [userName, setUserName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    registerUser({ userName, email, password })
  }

  return (
    <GlassCard intensity="medium" className="p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-semibold text-foreground mb-4">Register User</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="userName">Username</Label>
          <Input
            id="userName"
            value={userName}
            onChange={e => setUserName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <div className="text-sm text-destructive">{error.message}</div>
        )}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? 'Registering...' : 'Register'}
        </Button>
      </form>
    </GlassCard>
  )
}
