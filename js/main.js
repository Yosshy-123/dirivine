const DEFAULT_INPUT=`/
.github
 README.md
 README.en.md
public
 index.html
 main.js
 socket.io.min.js
 style.css
 logo.png
 favicon-16x16.png
 favicon-32x32.png
 favicon-96x96.png
src
  worker.js
variants
 standalone
  server.js
  package.json
 redis-only
  server.js
  package.json
server.js
package.json
LICENSE
render.yaml`

const input=document.getElementById("input")
const output=document.getElementById("output")
const slash=document.getElementById("slash")
const copy=document.getElementById("copy")
const reset=document.getElementById("reset")

function isLastSibling(lines,i,indent){
  for(let j=i+1;j<lines.length;j++){
    const ni=lines[j].match(/^\s*/)[0].length
    if(ni===indent)return false
    if(ni<indent)return true
  }
  return true
}

function parse(text){
  const lines=text.split("\n").filter(l=>l.trim()!=="")
  const stack=[]
  let out=""
  lines.forEach((line,i)=>{
    const indent=line.match(/^\s*/)[0].length
    const name=line.trim()
    if(name==="/"){
      out+="/\n"
      return
    }
    while(stack.length&&stack[stack.length-1].indent>=indent) stack.pop()
    const nextIndent=i<lines.length-1?lines[i+1].match(/^\s*/)[0].length:-1
    const isDir=nextIndent>indent
    const last=isLastSibling(lines,i,indent)

    let prefix=""
    stack.forEach(s=>prefix+=s.last?"   ":"│  ")
    out+=prefix+(last?"└─ ":"├─ ")+name+(isDir&&slash.checked?"/":"")+"\n"
    stack.push({indent,last})
  })
  return out
}

function syncScroll(from,to){
  const ratio=from.scrollTop/(from.scrollHeight-from.clientHeight||1)
  to.scrollTop=ratio*(to.scrollHeight-to.clientHeight)
}

let lock=false

input.addEventListener("scroll",()=>{
  if(lock)return
  lock=true
  syncScroll(input,output)
  lock=false
})

output.addEventListener("scroll",()=>{
  if(lock)return
  lock=true
  syncScroll(output,input)
  lock=false
})

function update(){
  output.textContent=parse(input.value)
  input.scrollTop=input.scrollHeight
  output.scrollTop=output.scrollHeight
  localStorage.setItem("dm-input",input.value)
  localStorage.setItem("dm-slash",slash.checked)
}

function load(){
  const saved=localStorage.getItem("dm-input")
  input.value=saved&&saved.trim()!==""?saved:DEFAULT_INPUT
  slash.checked=localStorage.getItem("dm-slash")==="true"
  update()
}

input.addEventListener("keydown",e=>{
  if(e.key!=="Enter")return
  const start=input.selectionStart
  const value=input.value
  const lineStart=value.lastIndexOf("\n",start-1)+1
  const line=value.slice(lineStart,start)
  const indent=line.match(/^\s*/)[0]
  e.preventDefault()
  const insert="\n"+indent
  input.value=value.slice(0,start)+insert+value.slice(start)
  const pos=start+insert.length
  input.selectionStart=input.selectionEnd=pos
  update()
})

copy.onclick=()=>{
  navigator.clipboard.writeText(output.textContent)
}

reset.onclick=()=>{
  localStorage.clear()
  input.value=DEFAULT_INPUT
  slash.checked=false
  update()
}

input.oninput=update
slash.onchange=update

document.addEventListener("DOMContentLoaded",load)
