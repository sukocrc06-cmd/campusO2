"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function AdminStajPage() {
  const [stajlar, setStajlar] = useState([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    async function fetchStajlar() {
      const { data } = await supabase.from('stajlar').select('*').order('created_at', { ascending: false });
      if (data) setStajlar(data);
      setLoading(false);
    }
    fetchStajlar();
  }, []);

  async function handleFinalOnay(id) {
    const { error } = await supabase.from('stajlar').update({ onay_durumu: 'yonetici_onayladi' }).eq('id', id);
    if (!error) {
      setStajlar(stajlar.map(s => s.id === id ? { ...s, onay_durumu: 'yonetici_onayladi' } : s));
    } else {
      alert('Hata: ' + error.message);
    }
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <h1>👔 Yönetici Staj Final Onay Paneli (Vol 1-3)</h1>
      {loading ? <p>Yükleniyor...</p> : stajlar.length === 0 ? <p>Kayıt yok.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead>
            <tr style={{ background: '#f4f4f4', textAlign: 'left' }}>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>Öğrenci ID</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>Kurum</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>Tarihler</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>Durum</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {stajlar.map((staj) => (
              <tr key={staj.id}>
                <td style={{ padding: '10px', border: '1px solid #ddd', fontSize: '12px' }}>{staj.student_id}</td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{staj.kurum_adi}</td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{staj.baslangic_tarihi} - {staj.bitis_tarihi}</td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{staj.onay_durumu.toUpperCase()}</td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                  {staj.onay_durumu === 'akademisyen_onayladi' ? (
                    <button onClick={() => handleFinalOnay(staj.id)} style={{ background: '#0070f3', color: '#fff', border: 'none', padding: '6px 12px', cursor: 'pointer' }}>Final Onayı Ver</button>
                  ) : <span>{staj.onay_durumu === 'yonetici_onayladi' ? 'Tamamlandı' : 'Bekliyor'}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
