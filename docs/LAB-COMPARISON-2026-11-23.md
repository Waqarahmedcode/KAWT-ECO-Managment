# Lab period comparison — 23 November 2026

Lab reports mein previous period, previous-year exact dates aur manual comparison range add hui. Overall reported tests/patient counts, Morning/Evening/Night aur test-wise counts ke tables current, previous, absolute change aur source-backed percent dikhate hain. Print/PDF, CSV aur Excel mein comparison available hai.

Missing source ko zero nahin maana jata. Partial source/count coverage, overlapping windows, incompatible period lengths aur badli hui overall test lists par growth suppress hoti hai. Matched individual tests alag compare ho sakte hain. Prior explicit zero aur new activity par percentage undefined rehta hai; dono explicit zero par zero change valid hai. Lab scopes mix nahin hote. Patient counts unique people ya clinical-quality score nahin.

Calendar month/half/year ki exact boundaries preserve hoti hain; months mein din alag ho sakte hain. Leap-day ya week dates invalid hon to manual selection ka message milta hai. Monthly aggregates ko daily observations mein split nahin kiya jata.

Computed coverage ab test-shift aur patient-shift level par alag hai. Do comparison periods ek SQL read snapshot aur existing lab RLS ke andar load hote hain. Source corrections ke liye purana revision/audit flow jari hai; comparison koi business record write nahin karta. Nayi schema migration/provider credential ki zaroorat nahin.

Verification: 44 unit tests, TypeScript, ESLint, optimized production build, isolated SQL/Auth/API/browser checks pass. API anonymous/unrelated roles ko deny karta hai; other-lab access data return nahin karta. Actual Excel workbook independent reader se khol kar aur native importer se dobara read karke verify hui; comparison rows dobara counts mein add nahin huin. Negative CSV values numeric rehti hain; untrusted spreadsheet strings escaped hain.

User ne owner email confirmation abhi incomplete batayi hai. Is phase mein hosted July report, doctor/package drafts ya fake comparison baseline import nahin hua. Original July sample ka local preview prior source missing dikhata hai; synthetic paired reports sirf disposable test DB mein use huay aur cleanup huay. Account confirmation ke baad source imports/admin acceptance baqi hain.
