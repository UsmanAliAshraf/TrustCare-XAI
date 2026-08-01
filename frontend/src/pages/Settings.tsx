import * as React from 'react'
import { toast } from 'sonner'
import { Save, Building2, Moon, Sun, Bell } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useSettings, type Settings as SettingsType } from '@/hooks/useSettings'
import { cn } from '@/lib/utils'

export default function Settings() {
  const { settings, update } = useSettings()
  const [draft, setDraft] = React.useState<SettingsType>(settings)

  const set = <K extends keyof SettingsType>(k: K, v: SettingsType[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))

  const save = () => {
    update(draft)
    toast.success('Settings saved.')
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your profile, hospital details and preferences."
        crumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Settings' }]}
        actions={
          <Button onClick={save}>
            <Save /> Save Changes
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="hospital">Hospital Name</Label>
              <Input
                id="hospital"
                value={draft.hospitalName}
                onChange={(e) => set('hospitalName', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doctor">Doctor Name</Label>
              <Input
                id="doctor"
                value={draft.doctorName}
                onChange={(e) => set('doctorName', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept">Department</Label>
              <Input
                id="dept"
                value={draft.department}
                onChange={(e) => set('department', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-2 block">Theme</Label>
              <div className="grid grid-cols-2 gap-3">
                {(['light', 'dark'] as const).map((t) => {
                  const Icon = t === 'light' ? Sun : Moon
                  return (
                    <button
                      key={t}
                      onClick={() => set('theme', t)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border p-3 text-sm font-medium capitalize transition-colors',
                        draft.theme === t
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'text-muted-foreground hover:bg-accent',
                      )}
                    >
                      <Icon className="h-4 w-4" /> {t}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">Notifications</div>
                  <div className="text-xs text-muted-foreground">
                    Alerts for high-risk patients and reminders.
                  </div>
                </div>
              </div>
              <Switch
                checked={draft.notifications}
                onCheckedChange={(v) => set('notifications', v)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        TrustCare XAI prototype · Predictions are simulated for demonstration. No machine-learning
        model is in use.
      </p>
    </div>
  )
}
