# Translating

The words the components show live in one catalog per language: `ui/i18n/<language>.ts`, with
`ui/i18n/en.ts` as the source. Each file exports its catalog as `export default { … }`. Each key
is `<Component>.<field>`, such as `Pagination.nextLabel`. A `{name}` in a message is a value the
component fills in. Keep every one, spelled the same. A message that is an object (`{ "one": …, "other": … }`) is a plural, with one
form per plural category of the language.

## The loop

1. Change the English in `en.ts`, and the same English in the component's code: a component
   without a provider shows the English written in its own code, and the guide's test holds the
   two equal.
2. Run `deno task test`. The catalog test (`ui/i18n/catalogs.test.ts`) lists every message that
   is missing, extra, empty, or out of date because its English changed, and every one whose
   placeholders, tags or plural forms differ from the English.
3. Translate what it lists, in every language.
4. Run `deno task i18n:stamp`. It records, in `ui/i18n/<language>.lock`, which English each
   translation was made from.
5. Run `deno task test` again. It passes once every language matches the English.

Stamp only after the translation is done: a stamp tells the test that the translation is up to
date.

## How to translate

Translate the situation, not the words. A translation made key by key from the catalog alone reads
like a machine made it, so:

1. Before translating a key, find where the code uses it (search for the quoted key) and read that
   screen or component: what the text sits next to (a button, a heading, a hint under a field, a
   toast) and what happens when a person acts on it.
2. Write what a native copywriter of the language would put in a modern, friendly app: natural word
   order, the phrasing well-known apps in that language use, no calques, no impersonal or
   bureaucratic passives, no literal noun chains.
3. Use the glossary below: one term per thing, on every screen.
4. Re-read the whole file as a user would, screen by screen, and fix anything that sounds
   translated.
5. A translation is done by an agent or person whose only task is that language, never as a side
   task of a code change. A change that adds or edits English leaves the other languages to that
   pass, in the same pull request, so the catalog test still passes.
6. A second reader checks every new translation: the owner for Russian, and for the other
   languages a separate agent that translates it back to English and compares the meaning with
   the source.

## Glossary

One word for one thing, on every screen. Translate a term the same way everywhere, unless the
sentence needs another grammatical form of it.

| English                | ru                        | es                        | de                       | pt-BR                      | ar                 | zh-CN         | ja                              | fr                       |
| ---------------------- | ------------------------- | ------------------------- | ------------------------ | -------------------------- | ------------------ | ------------- | ------------------------------- | ------------------------ |
| account                | аккаунт                   | cuenta                    | Konto                    | conta                      | حساب               | 账号          | アカウント                      | compte                   |
| sign in                | войти / вход              | iniciar sesión            | anmelden / Anmeldung     | entrar                     | تسجيل الدخول       | 登录          | ログイン                        | se connecter / connexion |
| sign out               | выйти                     | cerrar sesión             | abmelden                 | sair                       | تسجيل الخروج       | 退出登录      | ログアウト                      | se déconnecter           |
| sign up                | зарегистрироваться        | registrarse               | registrieren             | criar conta                | إنشاء حساب         | 注册          | 新規登録                        | créer un compte          |
| username               | логин                     | nombre de usuario         | Benutzername             | nome de usuário            | اسم المستخدم       | 用户名        | ユーザー名                      | nom d’utilisateur        |
| e-mail (address)       | e-mail, почта             | correo electrónico        | E-Mail-Adresse           | e-mail                     | البريد الإلكتروني  | 邮箱          | メールアドレス                  | adresse e-mail           |
| password               | пароль                    | contraseña                | Passwort                 | senha                      | كلمة المرور        | 密码          | パスワード                      | mot de passe             |
| passkey                | ключ доступа              | llave de acceso           | Passkey                  | chave de acesso            | مفتاح المرور       | 通行密钥      | パスキー                        | clé d’accès              |
| one-time code          | одноразовый код           | código de un solo uso     | Einmalcode               | código de uso único        | رمز لمرة واحدة     | 一次性验证码  | ワンタイムコード                | code à usage unique      |
| two-factor             | двухфакторная защита      | verificación en dos pasos | Zwei-Faktor-Schutz       | verificação em duas etapas | التحقق بخطوتين     | 双重验证      | 2段階認証                       | double authentification  |
| recovery codes         | резервные коды            | códigos de recuperación   | Wiederherstellungscodes  | códigos de recuperação     | رموز الاسترداد     | 恢复码        | リカバリーコード                | codes de récupération    |
| profile                | профиль                   | perfil                    | Profil                   | perfil                     | الملف الشخصي       | 个人资料      | プロフィール                    | profil                   |
| settings               | настройки                 | ajustes                   | Einstellungen            | configurações              | الإعدادات          | 设置          | 設定                            | paramètres               |
| group                  | группа                    | grupo                     | Gruppe                   | grupo                      | مجموعة             | 群组          | グループ                        | groupe                   |
| member                 | участник                  | miembro                   | Mitglied                 | membro                     | عضو                | 成员          | メンバー                        | membre                   |
| owner (of a group)     | владелец                  | propietario               | Inhaber                  | dono                       | المالك             | 所有者        | オーナー                        | propriétaire             |
| role                   | роль                      | rol                       | Rolle                    | função                     | دور                | 角色          | ロール                          | rôle                     |
| invitation             | приглашение               | invitación                | Einladung                | convite                    | دعوة               | 邀请          | 招待                            | invitation               |
| note                   | заметка                   | nota                      | Notiz                    | nota                       | ملاحظة             | 笔记          | メモ                            | note                     |
| tag                    | метка                     | etiqueta                  | Tag                      | etiqueta                   | وسم                | 标签          | タグ                            | étiquette                |
| file / attachment      | файл                      | archivo                   | Datei                    | arquivo                    | ملف                | 文件          | ファイル                        | fichier                  |
| device                 | устройство                | dispositivo               | Gerät                    | dispositivo                | جهاز               | 设备          | デバイス                        | appareil                 |
| notification           | уведомление               | notificación              | Benachrichtigung         | notificação                | إشعار              | 通知          | 通知                            | notification             |
| plan                   | тариф                     | plan                      | Tarif                    | plano                      | خطة                | 套餐          | プラン                          | forfait                  |
| subscription / billing | подписка / оплата         | suscripción / facturación | Abo / Abrechnung         | assinatura / cobrança      | الاشتراك / الفوترة | 订阅 / 账单   | サブスクリプション / 請求       | abonnement / facturation |
| guest (account)        | гостевой аккаунт          | cuenta de invitado        | Gastkonto                | conta de visitante         | حساب ضيف           | 访客账号      | ゲストアカウント                | compte invité            |
| demo data, sample data | демо-данные               | datos de ejemplo          | Beispieldaten            | dados de exemplo           | بيانات تجريبية     | 示例数据      | サンプルデータ                  | données d’exemple        |
| link (a URL)           | ссылка                    | enlace                    | Link                     | link                       | رابط               | 链接          | リンク                          | lien                     |
| token (API)            | токен                     | token                     | Token                    | token                      | رمز مميز           | 令牌          | トークン                        | jeton                    |
| operator (admin area)  | оператор                  | operador                  | Operator                 | operador                   | المشغّل             | 运营人员      | オペレーター                    | opérateur                |
| newsletter             | рассылка                  | boletín                   | Newsletter               | newsletter                 | النشرة البريدية    | 邮件简报      | ニュースレター                  | newsletter               |
| offline                | офлайн, без сети          | sin conexión              | offline                  | offline                    | دون اتصال          | 离线          | オフライン                      | hors ligne               |
| archive (verb / state) | убрать в архив / в архиве | archivar / archivado      | archivieren / archiviert | arquivar / arquivado       | أرشفة / في الأرشيف | 归档 / 已归档 | アーカイブする / アーカイブ済み | archiver / archivé       |
| delete (record)        | удалить                   | eliminar                  | löschen                  | excluir                    | حذف                | 删除          | 削除                            | supprimer                |
| remove (from a list)   | убрать                    | quitar                    | entfernen                | remover                    | إزالة              | 移除          | 外す                            | retirer                  |
| restore                | восстановить              | restaurar                 | wiederherstellen         | restaurar                  | استعادة            | 恢复          | 復元                            | restaurer                |
| upload                 | загрузить                 | subir                     | hochladen                | enviar                     | رفع                | 上传          | アップロード                    | importer                 |
| sync                   | синхронизация             | sincronización            | Synchronisierung         | sincronização              | المزامنة           | 同步          | 同期                            | synchronisation          |
| conflict               | конфликт                  | conflicto                 | Konflikt                 | conflito                   | تعارض              | 冲突          | 競合                            | conflit                  |
| theme                  | тема                      | tema                      | Design                   | tema                       | المظهر             | 主题          | テーマ                          | thème                    |
| retry                  | повторить                 | reintentar                | erneut versuchen         | tentar de novo             | إعادة المحاولة     | 重试          | 再試行                          | réessayer                |
| dismiss                | скрыть / закрыть          | cerrar                    | schließen / ausblenden   | fechar                     | إخفاء              | 关闭          | 閉じる                          | fermer                   |

## Voice

Short, plain and friendly, as a person would say it. The same voice in every language:

| Language             | File       | Voice                                                            |
| -------------------- | ---------- | ---------------------------------------------------------------- |
| German               | `de.ts`    | `du`, lower-case. "Versuche es noch einmal."                     |
| Spanish              | `es.ts`    | `tú`, neutral Spanish, gender-neutral where it costs nothing.    |
| Brazilian Portuguese | `pt-BR.ts` | `você`. "Tente de novo."                                         |
| Russian              | `ru.ts`    | `вы`, lower-case. "Попробуйте ещё раз."                          |
| Arabic               | `ar.ts`    | Modern Standard Arabic, addressing the reader directly.          |
| French               | `fr.ts`    | `vous`. "Réessayez."                                             |
| Japanese             | `ja.ts`    | Polite です/ます form, no 「あなた」. "もう一度お試しください。" |
| Simplified Chinese   | `zh-CN.ts` | Mainland terms, `你`, plain and warm. "请重试。"                 |

A button says what it does, as a verb: "Speichern", not "Speicherung". An error says what happened
and what to do next. Use the typographic quotes of the language: „…“ in German, «…» in Spanish,
Russian and Arabic, “…” in Brazilian Portuguese and Simplified Chinese, «…» with non-breaking
spaces inside in French, 「…」 in Japanese. French puts a non-breaking space before `: ; ! ?`.
Chinese and Japanese use full-width punctuation (，。：！？) and no space between words; a Latin word
or a `{placeholder}` inside the sentence takes no added space either, except where the language's
apps commonly put one.

## Terms kept in English

- Key names on the keyboard: Enter, Tab, Esc, Shift, Ctrl, Control, Alt, Option, Command, Meta,
  Backspace, Delete. Translate Space and the arrows (`Kbd.space`, `Kbd.up`): those are words a
  person reads, not the label printed on the key.
- `HEX` in `ColorField.hexCode`, and colour codes such as `#59168b`.
- Product, brand and file-format names.

## Length

The English length is the budget. A longer translation must still fit:

| Keys                                                                      | Limit                           |
| ------------------------------------------------------------------------- | ------------------------------- |
| Chips and marks: `StatusMark.*`, `OnOffButtons.*`, `PlanCard.status.*`    | one or two words, 16 characters |
| Buttons and links: `*.closeLabel`, `*.nextLabel`, `*.doneLabel`, `Tour.*` | about 1.5 times the English     |
| Keys: `Kbd.*`                                                             | one or two words                |
| Placeholders and hints: `*.placeholder`, `FileInput.dropHint`             | one short line                  |
| Hidden labels, announcements and errors                                   | no limit; say it fully          |

## Messages that need care

- `ResendButton.readyText` ends where the button starts: "Not there? Check your spam folder, or
  [Send it again]". Write it so that it runs into `ResendButton.label`, and start that label in lower case where the language does so mid-sentence ("oder erneut senden").
- `PageHero.by` comes before the author's name, and `PageHero.updated` before a date.
- `KanbanBoard.*` and `SortableList.*` are read aloud to a person moving a card with the keyboard:
  keep each one a full sentence.
- An Arabic plural has six forms (`zero`, `one`, `two`, `few`, `many`, `other`); `one` and `two`
  usually need no number.
