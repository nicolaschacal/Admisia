INSERT INTO crm_settings(key, value) VALUES
(
  'profile',
  '{
    "name":"Colegio Nubarian",
    "category":"Educación",
    "shortDescription":"Colegio Nubarian · Inicial y Primaria",
    "statusText":"Inscripciones abiertas",
    "addressLine1":"Av. Agraciada 2850",
    "addressLine2":"11800 Montevideo, Uruguay",
    "mapQuery":"Av. Agraciada 2850 Montevideo Uruguay",
    "phoneDisplay":"2208 0628",
    "phoneE164":"+59822080628",
    "email":"nubarian@nubarian.edu.uy",
    "website":"https://nubarian.edu.uy",
    "instagram":"https://www.instagram.com/colegionubarian/",
    "instagramLabel":"@colegionubarian",
    "facebook":"https://www.facebook.com/colegionubarian/",
    "facebookLabel":"Colegio Nubarian",
    "openHour":8,
    "closeHour":18,
    "weekdays":[1,2,3,4,5],
    "badgeEnabled":true
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
