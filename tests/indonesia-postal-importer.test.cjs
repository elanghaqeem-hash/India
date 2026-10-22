const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
test('postal importer normalizes Papua Barat Daya without fabricating official district codes',()=>{
 const script=String.raw`
import importlib.util
spec=importlib.util.spec_from_file_location("postal","scripts/import-indonesia-postal.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
base={
 "kode_wilayah":"92.01.01.2001","kode_pos":"98211","prov_code":"92",
 "kab_code":"01","kec_code":"01","desa":"Contoh UAT",
 "dt2":"Kabupaten","kabupaten":"Sorong","kecamatan":"Contoh",
 "is_kelurahan":"0","provinsi":"Papua Barat Daya",
}
pbd=mod.map_row(base)
assert pbd[0]=="PBD:92.01.01.2001"
assert pbd[2]=="96"
assert pbd[4]=="PBD-01"
assert pbd[6]=="PBD-01-01"
assert pbd[9]=="Desa"
normal=dict(base, kode_wilayah="32.73.19.1001",kode_pos="40111",prov_code="32",
 kab_code="73",kec_code="19",desa="Braga",dt2="Kota",kabupaten="Bandung",
 kecamatan="Sumur Bandung",is_kelurahan="1",provinsi="Jawa Barat")
bdg=mod.map_row(normal)
assert bdg[0]=="32.73.19.1001"
assert bdg[2]=="32"
assert bdg[9]=="Kelurahan"
assert bdg[4]=="32.73"
print("Importer normalization PASS")
`;
 const out=spawnSync('python3',['-c',script],{encoding:'utf8'});
 assert.equal(out.status,0,out.stderr||out.stdout);
 assert.match(out.stdout,/PASS/);
});
