/**
 * Created by magnus on 2017-01-18.
 */

const restify = require('restify-clients');
const md5 = require("md5");
const _ = require("lodash");
const printf = require("util").format;
let missingError = new Error("Entry is deleted or does not exist");
class RestService
{
    constructor(url,username,password)
    {
        this.username = username;
        this.password = password;
        this.client = restify.createStringClient(
            {
                url:printf("%s/service/v4_1/rest.php",url)
            }
        );
    }
    call(method,restData)
    {
        let promise = restData => new Promise((resolve,reject) =>
        {
            this.client.post({},
                {
                    method: method,
                    input_type: "JSON",
                    response_type: "JSON",
                    rest_data: JSON.stringify(restData),
                    application_name: "test",
                    name_value_list: {}
                },function(err,req,res,data)
                {
                    if(err)
                    {
                        reject(err);
                    }
                    else {
                        if(res.statusCode==200)
                        {
                            let parsedData = JSON.parse(data);
                            if(parsedData.number)
                            {
                                reject(new Error(parsedData.description,parsedData.name));
                            }
                            else
                            {
                                resolve(parsedData);
                            }

                        }
                        else
                        {
                            reject(res.statusCode);
                        }

                    }
                });
        });
        if(method!="login")
        {
            return this.getSessionId().then(function(sessionId)
            {
                return promise(_.extend({session:sessionId},restData));
            });
        }
        else
        {
            return promise(restData);
        }


    }
    getSessionId()
    {
        if(this.sessionId)
        {
            return Promise.resolve(this.sessionId);
        }
        return this.call("login", {
            user_auth: {
                user_name: this.username,
                password: md5(this.password)
            }
        }).then(_.bind(data =>
        {
            this.sessionId = data.id;
            return Promise.resolve(data.id);
        },this));
    }

    toNameValueList(object)
    {
        let obj = [];
        _.keys(object).forEach(function(key)
        {
            obj.push({name:key,value:object[key]});
        });
        return obj;
    }

    fromNameValueList(nvList)
    {
        let obj = {};
        _.forEach(nvList,nv =>
        {
           obj[nv.name] = nv.value;
        });
        return obj;
    }

    saveEntry(moduleName,object)
    {
        return this.call("set_entry",
            {
                module_name:moduleName,
                name_value_list:this.toNameValueList(object)

            }).then(_.bind(data =>
        {
            if(this.entryExists(data.entry_list))
            {
                return Promise.resolve(data.id);
            }
            else
            {
                return Promise.reject(missingError);
            }

        },this));
    }

    saveEntries(moduleName,array)
    {
        return this.call("set_entries",
            {
                moduleName:moduleName,
                name_value_lists:_.map(array,this.toNameValueList)
            }).then(data =>
        {
            return data.ids;
            //just filter out removed
            //Promise.resolve(_.filter())
        })
    }

    entryExists(entry)
    {
        return !(entry && entry.name_value_list && this.fromNameValueList(entry.name_value_list).deleted);
    }

    deleteEntry(moduleName,id)
    {
        return this.getEntry(moduleName,id).then(() =>this.saveEntry(moduleName,{id:id,deleted:true}));
    }

    getEntry(moduleName,id)
    {
        return this.call("get_entry",
            {
                module_name:moduleName,
                id:id,
                //TODO: Make this field a parameter?
                select_fields:['id','name','description'],
                link_name_to_fields_array:{},
                track_view:false
            }).then(_.bind(data =>
        {
            if(data.entry_list.length == 1)
            {
                if(!this.entryExists(data.entry_list[0]))
                {
                    return Promise.reject(missingError);
                }
                else
                {
                    return Promise.resolve(this.fromNameValueList(data.entry_list[0].name_value_list));
                }
            }
            else
            {
                return Promise.reject(new Error("All hell has broken loose."));
            }
        },this));
    }

    setRelationship(moduleName,moduleId,linkName,relatedId)
    {
        return this.call("set_relationship",{
            module_name:moduleName,
            module_id:moduleId,
            link_field_name:linkName,
            related_ids:relatedId,
            name_value_list:{},
            delete:0
        });
    }

    getRelationship(moduleName,moduleId,linkName)
    {
        return this.call("get_relationships",
            {
                module_name:moduleName,
                module_id:moduleId,
                link_field_name:linkName,
                related_module_query:"",
                related_fields:['id','name'],
                related_module_link_name_to_fields_array:{},
                deleted:0,
                order_by:'',
                offset:0,
                limit:200
            }).then(data =>
        {
            return Promise.resolve(_.map(_.map(data.entry_list,"name_value_list"),this.fromNameValueList));
        })
    }

    setDocumentRevision(documentId, fileBuffer, filename, revision=1)
    {
        return this.call("set_document_revision",
            {
                note:
                    {
                        id:documentId,
                        file:fileBuffer.toString('base64'),
                        filename:filename,
                        revision:revision
                    }
            });
    }

    getDocumentRevision(revisionId)
    {
        return this.call("get_document_revision",
            {
                i:revisionId
            }).then((res) =>
        {
            return Promise.resolve(res.document_revision);
        });
    }

    /**
     *
     * @param documentName
     * @param description
     * @param fileBuffer
     * @param filename
     * @param documentDate
     * @returns {Promise.<documentId>}
     */
    saveDocument(documentName,description,fileBuffer,filename,documentDate=new Date())
    {

        return this.saveEntry("Documents",
            {
                document_name:documentName,
                date_entered:documentDate,
                description:description
            }).then((id)=>
        {
            return this.setDocumentRevision(id,fileBuffer,filename).then(() =>
            {
                return Promise.resolve(id);
            });
        });
    }
}
module.exports = RestService;