# Legacy plate rights reconciliation

Audit date: 26 August 2026

All 31 records formerly marked `pending-owner-confirmation-before-public-release`
are now source-bound to completed built-in ImageGen receipts. For each record,
the receipt output PNG and active JPEG were hashed, the exact revised prompt was
bound by SHA-256 without rewriting it, and the active JPEG was reproduced
byte-for-byte from the receipt PNG with the recorded `sips` encoding settings.
The owner’s 24 August 2026 AGPL-3.0 direction therefore applies to these
project-directed original outputs on the same basis as the existing cleared
campaign assets.

This is a rights/provenance reconciliation only. It does not alter any image,
prompt, chapter-scene receipt, or independent-artwork count, and it does not
by itself authorize publication.

| Logical ID | Source SHA-256 | Receipt ID | Original PNG SHA-256 | Byte-exact encoding |
| --- | --- | --- | --- | --- |
| `plate:aromatics-apothecary-atlas` | `122d95b00ba8e55b30759bf715160c5b52ecb634c56a1cd8c2eb6af8d64e6374` | `exec-cca488bc-b01f-40ce-9493-fcdcd9a060f9` | `2bb6162e63e98798c3b3498f6ab096ba10e018e0c64ecb816e8c79e775d91a9b` | `sips format=jpeg formatOptions=88` |
| `plate:birds-domestic-insects-atlas` | `e5e4bcd1504f877bc295f42c05f1084f9ff73f0249d3b92a2f4f8eb4d44b2f58` | `exec-650c1f1d-0acc-40e3-8cfb-3f1a7bc2510c` | `195d7136b86248887c0288d73b98c2936c1e4ec9f6d31e300db5b6d7a4db245a` | `sips format=jpeg formatOptions=90` |
| `plate:birds-insects-flight` | `d5b786e772fc647c3b89e7d3224f8e9d2ab0300e34a0de2d1bd9c59bb56096ce` | `exec-97874927-2a54-439a-a70b-dda2b776fdfd` | `1b0d3bae125a334967a0b61e9fc75bc6fbae377bcdccf1300f4d6188cefd3cdc` | `sips format=jpeg formatOptions=88` |
| `plate:birds-insects-reptiles-atlas` | `017e6f03c8292cef33030114cecdb695074e0b3255c8f54dca4cb756af2930b1` | `exec-e6456dd5-93df-4ff4-823b-2c923652da14` | `46f9f753f9540391668bc603fa961202aff06b98a316e302458ad38da3ba74e1` | `sips format=jpeg formatOptions=88` |
| `plate:botany-materia-medica-atlas` | `8a730b9f95270b105dc4a839611bf2ee62d5714477d7fe812d39e0f16c974f87` | `exec-13e9fea7-8b80-45cd-8dd2-227916f58c53` | `eb5817c2ffb15677b8748d106d8badb2c4aac8a42eb14b6b639386e4b40f295d` | `sips format=jpeg formatOptions=88` |
| `plate:celestial-weather-phenomena-atlas` | `7039e46e78bd2dcf8b795e577942ba83b787d711a2d22dc552556668c78296a8` | `exec-a8e8632f-155b-4c63-80e5-46d67b005f01` | `142717fcb1793d6abd0c265f5d109c58a4d15060de09dd51d7d08aa98a15dea5` | `sips format=jpeg formatOptions=88` |
| `plate:cosmos-four-elements` | `096cf04f27717e8ac593b22e35aeee61ca0a3d0e0a2ae2d2348f700dc0caf69e` | `exec-84b9f22c-4326-4f1c-b91f-ad5c02edb8d7` | `139c2593f5caabed377e53d58db85aa3f4f8abc39000e764f4736862a2a02d17` | `sips format=jpeg formatOptions=88` |
| `plate:creatures-papyrus-lacuna-atlas` | `eec00804b8d4482ce549691d365ff0b32a03926585a67d5654bbc2dca4c44fe3` | `exec-7ea11099-be1f-4b23-b531-f81b90854a48` | `15d1afe3e9f7b61e35ba369ed8ca8fe3792a907ea8eed21ae5990032e5cf998f` | `sips format=jpeg formatOptions=90` |
| `plate:crops-flowers-herbs-remedies-atlas` | `f9a26c023f2787095fbaa6e9bc0854df5df6e6920683eacb645b0dd42e608ad6` | `exec-6037eb0e-aeca-41b2-9f86-eee9adfac716` | `b9e415f89dc73cd684cae1ef8d5ed3b91cefd2d129fdc2955e0b95d1457d3a91` | `sips format=jpeg formatOptions=88` |
| `plate:dedication-pliny-vespasian` | `42331de0bd9868cf31229663277476df0083b4a59bd6a8883dfe769ec1e01fa4` | `exec-9c7e3c60-36e9-4827-8d31-cf0166d809e0` | `f5979b5005b7b3dd63ca32cb7b975b84b6dbd3786ec31d3a50fb59fdf320d3e0` | `sips format=jpeg formatOptions=88` |
| `plate:earth-regions-phenomena-atlas` | `4b1afcd5ef3f748f91da68870550227a9fd1bed6da16d665c9d1d542c8851423` | `exec-47fe7e0b-251e-4813-b9c6-e278fdec0894` | `025d2833d2a13bf69896c7816c29515df1e4d95fe4dc9f307e33c7ced40a4afe` | `sips format=jpeg formatOptions=86` |
| `plate:elephant-life-actions-atlas` | `6208697d6ed8ff023c12a58629d3c7dc4b80b2556b65ca718a4dbb8a0c4fb100` | `exec-a072994d-ac96-43a2-91cc-24eb7b2a4386` | `2a68489761d421571edd383e52d5b96a0a2671fbb2e961c28a20154568a0cd79` | `sips format=jpeg formatOptions=88` |
| `plate:europe-africa-asia-peoples-atlas` | `2100d34f4d60f1124f4697ed232de4575503f2471f32104e7c95b534652c961c` | `exec-1bd04abf-ae00-4631-98b9-23bb085dd0d8` | `bc2e667b480e62ff21a8a784b7b839220d15af148c44eeee6b2ff800b478ef19` | `sips format=jpeg formatOptions=88` |
| `plate:human-life-belief-atlas` | `7fbc867044eb2dcd22f3263057e24da81274a1d2ebe4e50216e7422a3283d1c4` | `exec-5a527c17-22ef-4a0c-b7c0-e452d870a2dd` | `5b3bc1cd10b6d9aa794b3cc858326551d9e04a542a0be6b6c70531499448d38d` | `sips format=jpeg formatOptions=88` |
| `plate:humanity-anatomy-healing` | `6c489fec2fd63e981a59fb04be50d72d214a2555dd40ccd75b160713e11c39d5` | `exec-de0319c7-7d35-4921-82c4-2461bca232de` | `b1bf095d3bd2fe2dccb3565aa330da8a5b5322188c0d18bddf2b6125a62abe2c` | `sips format=jpeg formatOptions=88` |
| `plate:marine-invertebrate-atlas` | `abcad8ec0cd4090afab1dde271460f1819f454a63eff1324ae021aed7fb605f5` | `exec-5d7af5ac-a2a1-4bd1-8c33-0fe40054e60a` | `9d1f4dd853734ca686c54e0aff2fd2f7bc02e4152cf0973585a2dfcb7cc83140` | `sips format=jpeg formatOptions=84` |
| `plate:marine-life-atlas` | `0e31b88c3216b32d35742b033103af56ce419a8c291d8726ceb87055538e8873` | `exec-77c351f4-99b0-4e69-a229-d8b55c9cc3b4` | `c7153681aa2cee4c4256b294580278b1a5e611fa2b4c695770eb14297560dd2c` | `sips format=jpeg formatOptions=88` |
| `plate:marine-waters-remedies` | `db479cbd7f4170e5ce33bc15d53d3bcc6a421c3b31c02db4fa2e521ec4ba75ac` | `exec-215fdff7-0124-4f15-b1c2-812a69fd984f` | `43cf8c87c8a63e5752b2166159c0105f3d724dfe9d0d72189d105db916add5b1` | `sips format=jpeg formatOptions=88` |
| `plate:medicinal-herbarium-atlas` | `1847bccdb2f88c35a82d6ebfdaf7ae47575c251ce47d664745c162dc005cc568` | `exec-b491e7b9-2f31-4af1-9988-9025d2cca3eb` | `91150e744eadf47075809ebb59fe79f2d9833db09239180b38d4d7398d146c3b` | `sips format=jpeg formatOptions=88` |
| `plate:mediterranean-coasts-routes-atlas` | `39cb60281c7420ed81050172392696f694a11439b2d156e0d5562be449bfd388` | `exec-ddd80dd8-c47c-418d-88d1-023ae00c7825` | `d1285959ebbcf8365d6431a9362bfea2fe1835deccce948c37c98ca91c17b1c4` | `sips format=jpeg formatOptions=88` |
| `plate:mineral-fire-lacuna-atlas` | `890e200f4cdb7e9d09decfc5ee69496ffa8a7c2b6cb6cb1cdf292eaa5c17a82e` | `exec-3e9439b5-7ac9-4207-9691-2ba29abf7b5c` | `10d4b2b983c4a7649c7ae95952dea95478118d350b3a608b147d6e93d74ea720` | `sips format=jpeg formatOptions=86` |
| `plate:minerals-metals-arts-atlas-v2` | `281e46786017b42ecb5e75bd3d9694cd9779390e6eb780b5182957ae13fcee6a` | `exec-ecdfdb16-6da0-47ce-a81e-ce9c6d4fd21c` | `ec591fad7a178ba6fb1f2c50ffb04e3210947f9924f16a56f654f73fac69aa20` | `sips format=jpeg formatOptions=88` |
| `plate:plinian-minor-herbs-atlas` | `8a1e5bcf49d47126ab5dda16ef753117f78e0ea639e1ced959dfd50b1afc7b4a` | `exec-7bc8d75a-7e7d-4e87-abd1-af84c152e8d1` | `ea8a637456f22b6cbf4935a7572bb9ec093f368fafbf2e9bcb42af3342b96f11` | `sips format=jpeg formatOptions=84` |
| `plate:pliny-younger-vesuvius-letters-atlas` | `48e1cc82a81ca0194d6cb9cd2af0630475bdcd14124edfb70d9c0030e6934b39` | `exec-19c62397-99c7-4070-9259-b5507a363ddd` | `ed9c0f8b601a7adac62bdefad3a0d96ba407f05de81a205d5e0044b296ea08a9` | `sips format=jpeg formatOptions=86` |
| `plate:rare-terrestrial-life-atlas` | `bfc626329d858f797bf1022294850ccd354ea15974bec7d7d263c203573ef0e8` | `exec-46077925-658e-43cb-86cc-e81ba5d353d0` | `b200e5aaf20aef8fa89eafe529ef01fb6cc264c348eb0a93eb0fe3683bc3ca43` | `sips format=jpeg formatOptions=90` |
| `plate:roman-cities-engineering-geography-atlas` | `ae3ce480baa29c5013fd92951f00789734efd106fccb60beb7be51e9c691e8bf` | `exec-81bfe0ae-dc28-4788-bb0b-546f21c7c5e4` | `e4e98dca96ac9c45007f9d8c8d26371fc67aae688429043e9c3c6dae323b6f67` | `sips format=jpeg formatOptions=88` |
| `plate:roman-medicine-anatomy-care-atlas` | `7934b3a5b2fc25920fee3a986a9080c4a071e60f5639cad3aace38612e7c53a5` | `exec-412c92b0-b518-4795-89d7-f11cc174d636` | `1786f26620b0009e0ec2ad12a45ab8f355e3f2d2f29c19f7b65bd1da353b10c4` | `sips format=jpeg formatOptions=88` |
| `plate:sky-measure-prodigies-atlas` | `da5c4224d3de75efbac8cdb29d342fc8cba75207bd8f2a45e367605ab239befd` | `exec-23d01cd4-77c0-4aa6-a8f9-f218d916b265` | `30d0861d376690618ae66cd751e60ce405d49aca5c478aa5fb866923b4c26411` | `sips format=jpeg formatOptions=88` |
| `plate:terrestrial-animals` | `646ffeb058ed4e8a31269f996206f97382106a13c470b2764b410d9e4425f3a3` | `exec-71aa2d11-0a82-48aa-8b95-bc4ce09fbb08` | `9ace65d553bf6eaa8acc22f66c1a6a6bb08ff0dc95c3cd4d98ca0610dc7facc2` | `sips format=jpeg formatOptions=88` |
| `plate:terrestrial-quadrupeds-atlas` | `1b783eb7378beb8f5c005a59a3fc63c4520ae8d98ae41dfb0254d1a56e9cfa58` | `exec-1934a5c5-9062-49ca-8251-a041f8ff6eee` | `b507566ff8d5cb07b63b1bc71fc0cced56230e683391fa6a9dd80af7ba053f7e` | `sips format=jpeg formatOptions=88` |
| `plate:trees-orchards-arboriculture-atlas` | `0f90a8fd7191b9be629ee7dd27a63e0e90b4e177603425b00a34580f1b67a8f2` | `exec-79b4574e-1441-41a9-a4ad-ce275dff4a42` | `69f71cc791133b6f969f18401953c67420d4d75a781f9dc038dfd7c257aa1d0b` | `sips format=jpeg formatOptions=88` |

The machine-readable record, including generated timestamps, exact prompt
digests, source dimensions, portable artifact references, and rights direction,
is in `assets-source/plates-provenance.json`.
