import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export default function ScanPage() {
  const router = useRouter()

  useEffect(() => {
    async function handleScanAndAttendance() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login?next=/scan')
        return
      }

      const studentId = session.user.id
      
      const { error } = await supabase
        .from('yoklamalar')
        .insert([{ student_id: studentId, tarih: new Date().toISOString() }])

      if (error) {
        console.error('Yoklama kaydedilirken hata oluştu:', error.message)
      }

      router.push('/')
    }

    handleScanAndAttendance()
  }, [router])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <p>🚀 Yoklamanız alınıyor, öğrenci paneline yönlendiriliyorsunuz...</p>
    </div>
  )
}
